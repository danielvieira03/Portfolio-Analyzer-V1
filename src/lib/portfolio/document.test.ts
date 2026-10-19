import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, MAX_BACKUP_CHARS, exportBackup, parseBackup, parseStoredDoc } from "./document";
import { newVisitorDoc, type PortfolioDoc } from "./ledger";

let n = 0;
const id = () => `id${++n}`;
const doc = (): PortfolioDoc => ({
  ...newVisitorDoc(id),
  isDemoData: false,
  pricesUpdatedAt: "2026-10-18T12:00:00.000Z",
  learnedFunds: [{ ticker: "MUB", name: "iShares Muni", assetClass: "Fixed Income", subtype: "Medium-term", durationYears: 6.2 }],
});
const now = new Date("2026-10-18T15:00:00Z");

describe("parseStoredDoc", () => {
  it("round-trips a saved portfolio", () => {
    const d = doc();
    expect(parseStoredDoc(JSON.stringify(d))).toEqual(d);
  });
  it("returns null for nothing, junk, or the wrong shape", () => {
    expect(parseStoredDoc(null)).toBeNull();
    expect(parseStoredDoc("")).toBeNull();
    expect(parseStoredDoc("{not json")).toBeNull();
    expect(parseStoredDoc("[]")).toBeNull();
    expect(parseStoredDoc(JSON.stringify({ version: 1 }))).toBeNull();
  });
  it("returns null for an unknown version", () => {
    expect(parseStoredDoc(JSON.stringify({ ...doc(), version: 2 }))).toBeNull();
  });
  it("returns null when a holding is damaged", () => {
    const d = doc();
    const bad = { ...d, holdings: [{ ...d.holdings[0], shares: -5 }] };
    expect(parseStoredDoc(JSON.stringify(bad))).toBeNull();
    const bad2 = { ...d, holdings: [{ ...d.holdings[0], assetClass: "Crypto" }] };
    expect(parseStoredDoc(JSON.stringify(bad2))).toBeNull();
  });
  it("fills in a missing no-live-price flag", () => {
    const d = doc();
    const { noLivePrice, ...rest } = d.holdings[0];
    void noLivePrice;
    const parsed = parseStoredDoc(JSON.stringify({ ...d, holdings: [rest] }));
    expect(parsed?.holdings[0].noLivePrice).toBe(false);
  });
});

describe("backup", () => {
  it("round-trips a portfolio (ids are new, demo flag is off)", () => {
    const d = doc();
    const r = parseBackup(exportBackup(d, now), () => `new${++n}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const noIds = (list: PortfolioDoc["holdings"]) => list.map((h) => ({ ...h, id: "" }));
    expect(noIds(r.doc.holdings)).toEqual(noIds(d.holdings));
    expect(r.doc.holdings[0].id).not.toBe(d.holdings[0].id);
    expect(r.doc).toMatchObject({ cash: d.cash, isDemoData: false, seeded: true, pricesUpdatedAt: d.pricesUpdatedAt, learnedFunds: d.learnedFunds });
  });
  it("records the format and the time", () => {
    const parsed = JSON.parse(exportBackup(doc(), now));
    expect(parsed).toMatchObject({ format: BACKUP_FORMAT, version: 1, exportedAt: "2026-10-18T15:00:00.000Z" });
  });
  it("keeps the 'no live price' flag", () => {
    const d = doc();
    d.holdings[0] = { ...d.holdings[0], noLivePrice: true };
    const r = parseBackup(exportBackup(d, now));
    expect(r.ok && r.doc.holdings[0].noLivePrice).toBe(true);
  });
  it("rejects text that is not JSON, or another kind of file", () => {
    expect(parseBackup("hello").ok).toBe(false);
    expect(parseBackup("{}").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "something-else", version: 1, cash: 0, holdings: [] })).ok).toBe(false);
  });
  it("rejects a file that is far too large", () => {
    const r = parseBackup("x".repeat(MAX_BACKUP_CHARS + 1));
    expect(r.ok).toBe(false);
  });
  it("rejects an invalid holding and says which one", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    file.holdings[1].shares = 0;
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Holding 2");
  });
  it("rejects a ticker listed twice in the same class", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    file.holdings.push({ ...file.holdings[0] });
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("twice");
  });
  it("rejects an out-of-range cash amount and a bad learned fund", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    expect(parseBackup(JSON.stringify({ ...file, cash: -1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...file, learnedFunds: [{ ticker: "X", name: "x", assetClass: "Fixed Income", subtype: "Commodities", durationYears: 1 }] })).ok).toBe(false);
  });
  it("accepts a minimal backup with no optional parts", () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, cash: 5, holdings: [] }));
    expect(r.ok && r.doc).toMatchObject({ holdings: [], cash: 5, learnedFunds: [], pricesUpdatedAt: null });
  });
});

describe("country compatibility", () => {
  it("loads a portfolio saved BEFORE the country field existed (country becomes null)", () => {
    const d = doc();
    const old = { ...d, holdings: d.holdings.map(({ country, ...rest }) => (void country, rest)) };
    const parsed = parseStoredDoc(JSON.stringify(old));
    expect(parsed).not.toBeNull();
    expect(parsed!.holdings.every((h) => h.country === null)).toBe(true);
  });
  it("restores a backup written before the country field existed", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    for (const h of file.holdings) delete h.country;
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok && r.doc.holdings.every((h) => h.country === null)).toBe(true);
  });
  it("keeps the country through a saved document and through a backup", () => {
    const d = doc();
    d.holdings[0] = { ...d.holdings[0], country: "NL" };
    expect(parseStoredDoc(JSON.stringify(d))?.holdings[0].country).toBe("NL");
    const r = parseBackup(exportBackup(d, now));
    expect(r.ok && r.doc.holdings[0].country).toBe("NL");
  });
  it("rejects a backup holding with an invalid country code", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    file.holdings[0].country = "Netherlands";
    expect(parseBackup(JSON.stringify(file)).ok).toBe(false);
  });
});

describe("fund breakdown compatibility", () => {
  const saved = { sectors: [{ name: "Information Technology", weight: 0.3 }], countries: [{ code: "US", weight: 0.9 }], updatedAt: "2026-10-18T12:00:00.000Z", status: "ok" as const };
  it("loads a portfolio saved BEFORE fund breakdowns existed (becomes empty)", () => {
    const { etfBreakdowns, ...old } = doc();
    void etfBreakdowns;
    const parsed = parseStoredDoc(JSON.stringify(old));
    expect(parsed).not.toBeNull();
    expect(parsed!.etfBreakdowns).toEqual({});
  });
  it("restores a backup written before fund breakdowns existed", () => {
    const file = JSON.parse(exportBackup(doc(), now));
    delete file.etfBreakdowns;
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok && r.doc.etfBreakdowns).toEqual({});
  });
  it("keeps breakdowns through a saved document and through a backup", () => {
    const d = { ...doc(), etfBreakdowns: { VOO: saved } };
    expect(parseStoredDoc(JSON.stringify(d))?.etfBreakdowns).toEqual({ VOO: saved });
    const r = parseBackup(exportBackup(d, now));
    expect(r.ok && r.doc.etfBreakdowns).toEqual({ VOO: saved });
  });
  it("drops damaged breakdowns (to be looked up again) without losing the portfolio", () => {
    const d = { ...doc(), etfBreakdowns: { VOO: { ...saved, countries: [{ code: "United States", weight: 1 }] } } };
    const parsed = parseStoredDoc(JSON.stringify(d));
    expect(parsed?.etfBreakdowns).toEqual({});
    expect(parsed?.holdings).toHaveLength(d.holdings.length);
    const file = JSON.parse(exportBackup({ ...doc(), etfBreakdowns: { VOO: saved } }, now));
    file.etfBreakdowns.VOO.sectors[0].weight = 5;
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok && r.doc.etfBreakdowns).toEqual({});
  });
  it("loads fund data saved before the translation version existed (counts as version 1) and keeps a saved version", () => {
    const old = { ...doc(), etfBreakdowns: { VOO: saved } };
    expect(parseStoredDoc(JSON.stringify(old))?.etfBreakdowns.VOO.mapping).toBeUndefined();
    const withVersion = { ...doc(), etfBreakdowns: { VOO: { ...saved, mapping: 2 } } };
    expect(parseStoredDoc(JSON.stringify(withVersion))?.etfBreakdowns.VOO.mapping).toBe(2);
    const r = parseBackup(exportBackup(withVersion, now));
    expect(r.ok && r.doc.etfBreakdowns.VOO.mapping).toBe(2);
  });
});
