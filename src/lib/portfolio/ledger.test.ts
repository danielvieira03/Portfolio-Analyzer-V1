import { describe, expect, it } from "vitest";
import { DEMO_PORTFOLIOS, demoById } from "@/config/demo-portfolios";
import type { HoldingInput } from "@/lib/holdings/schema";
import {
  addHolding, addLearnedFunds, applyBreakdowns, applyPrices, clearDemo, fillSubtypes, importHoldings, libraryFunds,
  applyClaudeBreakdowns, applyClaudeSectors, applyDurations, demoDoc, emptyDoc, removeHolding, saveHolding, setCash, type PortfolioDoc,
} from "./ledger";

let n = 0;
const id = () => `id${++n}`;
const input = (o: Partial<HoldingInput> = {}): HoldingInput => ({
  ticker: "AAPL", name: "Apple Inc.", assetClass: "Equities", sector: "Information Technology", subtype: null, country: null, dividend: null,
  shares: 10, costBasisPerShare: 100, currentPrice: 150, ...o,
});
const empty = (o: Partial<PortfolioDoc> = {}): PortfolioDoc => ({
  version: 1, holdings: [], cash: 0, isDemoData: false, seeded: true, pricesUpdatedAt: null, learnedFunds: [], etfBreakdowns: {}, durations: {}, sectorTries: {}, ...o,
});
const withApple = () => addHolding(empty(), input(), undefined, id).doc;

describe("demoDoc", () => {
  it("is a demo portfolio marked as demo data, with fresh unique ids and its funds' weights", () => {
    for (const demo of DEMO_PORTFOLIOS) {
      const d = demoDoc(demo.id, id);
      expect(d.holdings).toHaveLength(demo.holdings.length);
      expect(d.isDemoData).toBe(true);
      expect(d.seeded).toBe(true);
      expect(d.cash).toBe(demo.cash);
      expect(new Set(d.holdings.map((h) => h.id)).size).toBe(d.holdings.length);
      expect(d.holdings.every((h) => h.noLivePrice === false)).toBe(true);
      // Every equity ETF and bond fund in the demo comes with its saved weights.
      const funds = d.holdings.filter((h) => h.assetClass === "Fixed Income" || h.sector === "Diversified");
      expect(funds.every((f) => d.etfBreakdowns[f.ticker]?.status === "ok")).toBe(true);
    }
  });
  it("two visitors get separate documents (no shared state)", () => {
    const a = demoDoc("global");
    const b = demoDoc("global");
    const a2 = removeHolding(a, a.holdings[0].id);
    expect(b.holdings).toHaveLength(demoById("global").holdings.length);
    expect(a2.holdings).toHaveLength(demoById("global").holdings.length - 1);
  });
});

describe("emptyDoc", () => {
  it("has nothing in it and is not demo data", () => {
    expect(emptyDoc()).toMatchObject({ holdings: [], cash: 0, isDemoData: false, seeded: true, etfBreakdowns: {}, learnedFunds: [] });
  });
});

describe("clearDemo", () => {
  it("empties the portfolio and never leaves demo mode on", () => {
    const d = clearDemo(demoDoc("global", id));
    expect(d).toMatchObject({ holdings: [], cash: 0, isDemoData: false, seeded: true });
  });
});

describe("addHolding", () => {
  it("adds a new holding and leaves demo mode", () => {
    const r = addHolding(demoDoc("global", id), input({ ticker: "ZZZ" }), undefined, id);
    expect(r.outcome).toBe("added");
    expect(r.doc.holdings.at(-1)).toMatchObject({ ticker: "ZZZ", noLivePrice: false });
    expect(r.doc.isDemoData).toBe(false);
  });
  it("reports a duplicate and changes nothing until told what to do", () => {
    const d = withApple();
    const r = addHolding(d, input({ shares: 5 }), undefined, id);
    expect(r.outcome).toBe("duplicate");
    expect(r.doc).toBe(d);
  });
  it("allows the same ticker in a different asset class", () => {
    const r = addHolding(withApple(), input({ assetClass: "Alternatives", sector: null }), undefined, id);
    expect(r.outcome).toBe("added");
    expect(r.doc.holdings).toHaveLength(2);
  });
  it("merges: adds shares, averages cost by share count, takes the newer price, keeps name and sector", () => {
    const r = addHolding(withApple(), input({ name: "Other", sector: null, shares: 30, costBasisPerShare: 200, currentPrice: 210 }), "merge", id);
    const h = r.doc.holdings[0];
    expect(r.outcome).toBe("merged");
    expect(h.shares).toBe(40);
    expect(h.costBasisPerShare).toBeCloseTo(175);
    expect(h.currentPrice).toBe(210);
    expect(h.name).toBe("Apple Inc.");
    expect(h.sector).toBe("Information Technology");
  });
  it("replaces with the new data and keeps the same id", () => {
    const d = withApple();
    const r = addHolding(d, input({ name: "New", shares: 1 }), "replace", id);
    expect(r.outcome).toBe("replaced");
    expect(r.doc.holdings).toHaveLength(1);
    expect(r.doc.holdings[0]).toMatchObject({ id: d.holdings[0].id, name: "New", shares: 1 });
  });
});

describe("saveHolding", () => {
  it("edits a holding in place", () => {
    const d = withApple();
    const r = saveHolding(d, d.holdings[0].id, input({ shares: 99 }));
    expect(r.ok && r.doc.holdings[0].shares).toBe(99);
  });
  it("refuses a ticker that collides with another holding of the same class", () => {
    let d = withApple();
    d = addHolding(d, input({ ticker: "MSFT" }), undefined, id).doc;
    const r = saveHolding(d, d.holdings[1].id, input({ ticker: "AAPL" }));
    expect(r).toEqual({ ok: false, error: "duplicate" });
  });
  it("lets a holding keep its own ticker", () => {
    const d = withApple();
    expect(saveHolding(d, d.holdings[0].id, input()).ok).toBe(true);
  });
  it("fails for an unknown id", () => {
    expect(saveHolding(withApple(), "nope", input())).toEqual({ ok: false, error: "not_found" });
  });
  it("keeps the 'no live price' flag and leaves demo mode", () => {
    const d = { ...withApple(), isDemoData: true };
    d.holdings[0] = { ...d.holdings[0], noLivePrice: true };
    const r = saveHolding(d, d.holdings[0].id, input());
    expect(r.ok && r.doc.holdings[0].noLivePrice).toBe(true);
    expect(r.ok && r.doc.isDemoData).toBe(false);
  });
});

describe("removeHolding and setCash", () => {
  it("removes by id", () => {
    const d = withApple();
    expect(removeHolding(d, d.holdings[0].id).holdings).toEqual([]);
  });
  it("sets cash and leaves demo mode", () => {
    const r = setCash(demoDoc("global", id), 1234);
    expect(r.cash).toBe(1234);
    expect(r.isDemoData).toBe(false);
  });
});

describe("importHoldings", () => {
  const base = () => addHolding(empty({ cash: 100 }), input(), undefined, id).doc;
  const file = [input({ shares: 5, costBasisPerShare: 200 }), input({ ticker: "MSFT", name: "Microsoft" })];

  it("add mode keeps what is there, adds new tickers, and skips repeats by default", () => {
    const { doc, result } = importHoldings(base(), "add", file, 50, "skip", id);
    expect(result).toEqual({ added: 1, merged: 0, replaced: 0, skipped: 1 });
    expect(doc.holdings.map((h) => h.ticker)).toEqual(["AAPL", "MSFT"]);
    expect(doc.holdings[0].shares).toBe(10);
    expect(doc.cash).toBe(150); // added to
  });
  it("add mode can average repeated tickers in", () => {
    const { doc, result } = importHoldings(base(), "add", file, undefined, "merge", id);
    expect(result).toMatchObject({ added: 1, merged: 1 });
    expect(doc.holdings[0].shares).toBe(15);
    expect(doc.holdings[0].costBasisPerShare).toBeCloseTo((10 * 100 + 5 * 200) / 15);
    expect(doc.cash).toBe(100); // no cash in file: unchanged
  });
  it("add mode can overwrite repeated tickers", () => {
    const { doc, result } = importHoldings(base(), "add", file, undefined, "replace", id);
    expect(result).toMatchObject({ added: 1, replaced: 1 });
    expect(doc.holdings[0]).toMatchObject({ shares: 5, costBasisPerShare: 200 });
  });
  it("replace mode wipes the current holdings and sets cash", () => {
    const { doc, result } = importHoldings(base(), "replace", [file[1]], 999, "skip", id);
    expect(result).toMatchObject({ added: 1, skipped: 0 });
    expect(doc.holdings.map((h) => h.ticker)).toEqual(["MSFT"]);
    expect(doc.cash).toBe(999);
  });
  it("leaves demo mode", () => {
    expect(importHoldings({ ...base(), isDemoData: true }, "add", [], undefined, "skip", id).doc.isDemoData).toBe(false);
  });
  it("does not change the document it was given", () => {
    const d = base();
    const snapshot = JSON.stringify(d);
    importHoldings(d, "add", file, 5, "merge", id);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

describe("applyPrices", () => {
  const d = (() => {
    let x = addHolding(empty({ isDemoData: true }), input(), undefined, id).doc;
    x = addHolding(x, input({ ticker: "ZZZ" }), undefined, id).doc;
    return { ...x, isDemoData: true };
  })();
  const [a, z] = d.holdings;
  const now = new Date("2026-10-18T12:00:00Z");

  it("saves found prices, flags missing ones, stamps the time, and stays in demo mode", () => {
    const r = applyPrices(d, { found: [{ id: a.id, price: 300 }], missing: [z.id] }, true, now);
    expect(r.holdings[0]).toMatchObject({ currentPrice: 300, noLivePrice: false });
    expect(r.holdings[1]).toMatchObject({ currentPrice: 150, noLivePrice: true });
    expect(r.pricesUpdatedAt).toBe("2026-10-18T12:00:00.000Z");
    expect(r.isDemoData).toBe(true);
  });
  it("clears the flag when a price is found later", () => {
    const flagged = applyPrices(d, { found: [], missing: [z.id] }, false, now);
    const fixed = applyPrices(flagged, { found: [{ id: z.id, price: 7 }], missing: [] }, true, now);
    expect(fixed.holdings[1]).toMatchObject({ currentPrice: 7, noLivePrice: false });
  });
  it("does not stamp the time when told not to", () => {
    expect(applyPrices(d, { found: [], missing: [] }, false, now).pricesUpdatedAt).toBeNull();
  });
});

describe("fillSubtypes", () => {
  const bonds = () => {
    let x = addHolding(empty(), input({ ticker: "BND", assetClass: "Fixed Income", sector: null }), undefined, id).doc;
    x = addHolding(x, input({ ticker: "TLT", assetClass: "Fixed Income", sector: null, subtype: "Long-term" }), undefined, id).doc;
    return x;
  };
  it("fills empty values only and never overwrites", () => {
    const r = fillSubtypes(bonds(), { "Fixed Income:BND": "Medium-term", "Fixed Income:TLT": "Short-term" });
    expect(r.updated).toBe(1);
    expect(r.doc.holdings.map((h) => h.subtype)).toEqual(["Medium-term", "Long-term"]);
  });
  it("ignores values that are not allowed for the class", () => {
    expect(fillSubtypes(bonds(), { "Fixed Income:BND": "Commodities" }).updated).toBe(0);
  });
  it("returns the same document when nothing changed", () => {
    const d = bonds();
    expect(fillSubtypes(d, {}).doc).toBe(d);
  });
});

describe("fund library", () => {
  const learned = { ticker: "MUB", name: "iShares Muni", assetClass: "Fixed Income", subtype: "Medium-term", durationYears: 6.2 };
  it("finds built-in funds", () => {
    expect(libraryFunds(empty(), ["bnd", "ZZZ"]).map((f) => f.ticker)).toEqual(["BND"]);
  });
  it("remembers a learned fund and finds it afterwards", () => {
    const d = addLearnedFunds(empty(), [learned]);
    expect(libraryFunds(d, ["MUB"])[0]).toMatchObject({ subtype: "Medium-term", durationYears: 6.2 });
  });
  it("never overwrites a built-in or an earlier learned fund", () => {
    const d1 = addLearnedFunds(empty(), [{ ...learned, ticker: "BND", subtype: "Long-term" }]);
    expect(d1.learnedFunds).toHaveLength(0);
    const d2 = addLearnedFunds(addLearnedFunds(empty(), [learned]), [{ ...learned, subtype: "Long-term" }]);
    expect(d2.learnedFunds).toHaveLength(1);
    expect(d2.learnedFunds[0].subtype).toBe("Medium-term");
  });
});

describe("country (hidden, from market data)", () => {
  const withCountry = (o: Partial<HoldingInput> = {}) => input({ country: "US", ...o });
  const asml = () => addHolding(empty(), withCountry({ ticker: "ASML", country: "NL" }), undefined, id).doc;

  it("is saved with a new holding", () => {
    expect(asml().holdings[0].country).toBe("NL");
  });
  it("is kept when merging a repeated ticker that has none", () => {
    const r = addHolding(asml(), input({ ticker: "ASML", country: null, shares: 5 }), "merge", id);
    expect(r.doc.holdings[0]).toMatchObject({ shares: 15, country: "NL" });
  });
  it("is kept when replacing with data that has none, and updated when it has one", () => {
    expect(addHolding(asml(), input({ ticker: "ASML", country: null }), "replace", id).doc.holdings[0].country).toBe("NL");
    expect(addHolding(asml(), input({ ticker: "ASML", country: "DE" }), "replace", id).doc.holdings[0].country).toBe("DE");
  });
  it("follows the form when a holding is edited (kept if carried, cleared if the form cleared it)", () => {
    const d = asml();
    const kept = saveHolding(d, d.holdings[0].id, input({ ticker: "ASML", country: "NL" }));
    expect(kept.ok && kept.doc.holdings[0].country).toBe("NL");
    const cleared = saveHolding(d, d.holdings[0].id, input({ ticker: "ASML", country: null }));
    expect(cleared.ok && cleared.doc.holdings[0].country).toBeNull();
  });
  it("is kept by imports that have none (add/merge and replace)", () => {
    const merged = importHoldings(asml(), "add", [input({ ticker: "ASML", country: null })], undefined, "merge", id);
    expect(merged.doc.holdings[0].country).toBe("NL");
    const replaced = importHoldings(asml(), "add", [input({ ticker: "ASML", country: null })], undefined, "replace", id);
    expect(replaced.doc.holdings[0].country).toBe("NL");
  });
  it("is saved by a price refresh for stocks, never erased, and ignored for funds", () => {
    let d = addHolding(empty(), input({ ticker: "TSM" }), undefined, id).doc;
    d = addHolding(d, input({ ticker: "BND", assetClass: "Fixed Income", sector: null }), undefined, id).doc;
    const [tsm, bnd] = d.holdings;
    const now = new Date("2026-10-18T12:00:00Z");
    const a = applyPrices(d, { found: [{ id: tsm.id, price: 200, country: "TW" }, { id: bnd.id, price: 70, country: "US" }], missing: [] }, true, now);
    expect(a.holdings[0].country).toBe("TW");
    expect(a.holdings[1].country).toBeNull();
    const b = applyPrices(a, { found: [{ id: tsm.id, price: 210 }], missing: [] }, true, now);
    expect(b.holdings[0]).toMatchObject({ currentPrice: 210, country: "TW" });
  });
  it("is set on the demo stocks, including foreign ones", () => {
    const demo = demoDoc("global", id).holdings;
    expect(demo.find((h) => h.ticker === "TM")?.country).toBe("JP");
    expect(demo.find((h) => h.ticker === "ASML")?.country).toBe("NL");
    expect(demo.find((h) => h.ticker === "VOO")?.country).toBeNull();
    expect(demo.find((h) => h.ticker === "BND")?.country).toBeNull();
  });
});

describe("applyBreakdowns", () => {
  const bd = (updatedAt: string) => ({ sectors: [{ name: "Energy", weight: 1 }], countries: [{ code: "US", weight: 1 }], updatedAt, status: "ok" as const });
  it("starts empty for a new portfolio", () => {
    expect(emptyDoc().etfBreakdowns).toEqual({});
  });
  it("saves new fund breakdowns, replaces a fund's old one and keeps the others", () => {
    const a = applyBreakdowns(empty(), { VOO: bd("2026-10-01T00:00:00.000Z"), QQQ: bd("2026-10-01T00:00:00.000Z") });
    const b = applyBreakdowns(a, { VOO: bd("2026-10-18T00:00:00.000Z") });
    expect(b.etfBreakdowns.VOO.updatedAt).toBe("2026-10-18T00:00:00.000Z");
    expect(b.etfBreakdowns.QQQ.updatedAt).toBe("2026-10-01T00:00:00.000Z");
  });
  it("changes nothing when there is nothing new, and never counts as an edit of demo data", () => {
    const d = demoDoc("global", id);
    expect(applyBreakdowns(d, {})).toBe(d);
    expect(applyBreakdowns(d, { VOO: bd("2026-10-18T00:00:00.000Z") }).isDemoData).toBe(true);
  });
});

describe("applyDurations", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("saves durations found and records every fund tried, found or not", () => {
    const d = applyDurations(empty(), { EMB: 6.3 }, ["EMB", "XYZ"], now);
    expect(d.durations).toEqual({ EMB: { years: 6.3, checkedAt: now.toISOString() }, XYZ: { years: null, checkedAt: now.toISOString() } });
  });
  it("never replaces a duration already found, but a fund tried with no answer can be filled in later", () => {
    const first = applyDurations(empty(), { EMB: 6.3 }, ["EMB", "XYZ"], now);
    const second = applyDurations(first, { EMB: 9, XYZ: 4.2 }, ["EMB", "XYZ"], new Date("2026-11-01T00:00:00Z"));
    expect(second.durations.EMB.years).toBe(6.3);
    expect(second.durations.XYZ.years).toBe(4.2);
  });
  it("changes nothing when there is nothing to save, and is never an edit of demo data", () => {
    const demo = demoDoc("global", id);
    expect(applyDurations(demo, {}, [], now)).toBe(demo);
    expect(applyDurations(demo, { ZZZ: 3 }, ["ZZZ"], now).isDemoData).toBe(true);
  });
  it("ignores an unusable number", () => {
    expect(applyDurations(empty(), { ABC: -2, DEF: Number.NaN }, ["ABC", "DEF"], now).durations).toMatchObject({ ABC: { years: null }, DEF: { years: null } });
  });
});

describe("applyPrices: a blank sector", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("is filled from the plan, and a sector that is set is never replaced", () => {
    const d = {
      ...empty(),
      holdings: [
        { id: "a", ticker: "AAA", name: "A", assetClass: "Equities" as const, sector: null, subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, noLivePrice: false, country: null },
        { id: "b", ticker: "BBB", name: "B", assetClass: "Equities" as const, sector: "Energy", subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, noLivePrice: false, country: null },
      ],
    };
    const r = applyPrices(d, { found: [{ id: "a", price: 5, sector: "Utilities" }, { id: "b", price: 5, sector: "Utilities" }], missing: [] }, true, now);
    expect(r.holdings.map((h) => h.sector)).toEqual(["Utilities", "Energy"]);
  });
  it("stays blank when the plan has no sector", () => {
    const d = { ...empty(), holdings: [{ id: "a", ticker: "AAA", name: "A", assetClass: "Equities" as const, sector: null, subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, noLivePrice: false, country: null }] };
    expect(applyPrices(d, { found: [{ id: "a", price: 5 }], missing: [] }, true, now).holdings[0].sector).toBeNull();
  });
});

describe("Claude-filled data", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const stockDoc = () => ({
    ...empty(),
    holdings: [
      { id: "a", ticker: "AAA", name: "A", assetClass: "Equities" as const, sector: null, subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, noLivePrice: false, country: null },
      { id: "b", ticker: "BBB", name: "B", assetClass: "Equities" as const, sector: "Energy", subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, noLivePrice: false, country: null },
    ],
  });
  const bd = (status: "ok" | "none", o = {}) => ({ sectors: status === "ok" ? [{ name: "Energy", weight: 1 }] : [], countries: [], updatedAt: "2026-10-01T00:00:00.000Z", status, ...o });

  it("applyClaudeSectors fills a blank sector, never replaces a set one, and records every try", () => {
    const r = applyClaudeSectors(stockDoc(), { AAA: "Utilities", BBB: "Materials" }, ["AAA", "BBB", "ZZZ"], now);
    expect(r.holdings.map((h) => h.sector)).toEqual(["Utilities", "Energy"]);
    expect(Object.keys(r.sectorTries).sort()).toEqual(["AAA", "BBB", "ZZZ"]);
  });
  it("applyClaudeSectors does nothing when nothing was tried, and is not an edit of demo data", () => {
    const d = stockDoc();
    expect(applyClaudeSectors(d, {}, [], now)).toBe(d);
    expect(applyClaudeSectors({ ...d, isDemoData: true }, { AAA: "Energy" }, ["AAA"], now).isDemoData).toBe(true);
  });
  it("applyClaudeBreakdowns saves weights read by Claude, keeping the market data's countries", () => {
    const d = { ...empty(), etfBreakdowns: { ETF: bd("none", { countries: [{ code: "US", weight: 1 }] }) } };
    const r = applyClaudeBreakdowns(d, { ETF: [{ name: "Energy", weight: 0.6 }, { name: "Materials", weight: 0.4 }] }, ["ETF"], now, 3);
    expect(r.etfBreakdowns.ETF).toMatchObject({ status: "ok", source: "claude", mapping: 3, countries: [{ code: "US", weight: 1 }] });
    expect(r.etfBreakdowns.ETF.sectors).toHaveLength(2);
  });
  it("applyClaudeBreakdowns records a fund Claude found nothing for as tried", () => {
    const r = applyClaudeBreakdowns(empty(), {}, ["ETF"], now, 3);
    expect(r.etfBreakdowns.ETF).toMatchObject({ status: "none", source: "claude", sectors: [], updatedAt: now.toISOString() });
  });
  it("applyBreakdowns: the market data's weights replace Claude's, but 'no data' never erases them", () => {
    const claude = { ...bd("ok"), source: "claude" as const };
    const d = { ...empty(), etfBreakdowns: { ETF: claude } };
    expect(applyBreakdowns(d, { ETF: bd("none") })).toBe(d);
    const replaced = applyBreakdowns(d, { ETF: bd("ok", { sectors: [{ name: "Materials", weight: 1 }] }) });
    expect(replaced.etfBreakdowns.ETF.source).toBeUndefined();
    expect(replaced.etfBreakdowns.ETF.sectors[0].name).toBe("Materials");
    // an ordinary 'none' still replaces an ordinary record, as before
    expect(applyBreakdowns({ ...empty(), etfBreakdowns: { X: bd("ok") } }, { X: bd("none") }).etfBreakdowns.X.status).toBe("none");
  });
});

describe("dividends on holdings", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const held = (o: object = {}) => ({ id: "a", ticker: "AAA", name: "A", assetClass: "Equities" as const, sector: "Energy", subtype: null, shares: 10, costBasisPerShare: 5, currentPrice: 5, noLivePrice: false, country: null, dividend: null, ...o });
  it("a new holding has no dividend yet (unavailable until a refresh)", () => {
    expect(addHolding(empty(), input({ ticker: "NEW" }), undefined, id).doc.holdings[0].dividend).toBeNull();
  });
  it("applyPrices saves the dividend, keeps the old one when the plan has none, and zero is a real value", () => {
    const d = { ...empty(), holdings: [held({ dividend: 2 })] };
    expect(applyPrices(d, { found: [{ id: "a", price: 6, dividend: 3 }], missing: [] }, true, now).holdings[0].dividend).toBe(3);
    expect(applyPrices(d, { found: [{ id: "a", price: 6 }], missing: [] }, true, now).holdings[0].dividend).toBe(2);
    expect(applyPrices(d, { found: [{ id: "a", price: 6, dividend: 0 }], missing: [] }, true, now).holdings[0].dividend).toBe(0);
  });
  it("editing a holding keeps its dividend, unless its ticker was changed", () => {
    const d = { ...empty(), holdings: [held({ dividend: 2 })] };
    const kept = saveHolding(d, "a", input({ ticker: "AAA", shares: 20 }));
    expect(kept.ok && kept.doc.holdings[0].dividend).toBe(2);
    const changed = saveHolding(d, "a", input({ ticker: "BBB" }));
    expect(changed.ok && changed.doc.holdings[0].dividend).toBeNull();
  });
  it("replacing or importing over a holding keeps its dividend", () => {
    const d = { ...empty(), holdings: [held({ dividend: 2 })] };
    expect(addHolding(d, input({ ticker: "AAA", sector: "Energy" }), "replace", id).doc.holdings[0].dividend).toBe(2);
    expect(importHoldings(d, "add", [input({ ticker: "AAA", sector: "Energy" })], undefined, "replace", id).doc.holdings[0].dividend).toBe(2);
  });
});
