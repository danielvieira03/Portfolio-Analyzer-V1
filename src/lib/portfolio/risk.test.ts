import { describe, expect, it } from "vitest";
import { RISK_SCORES } from "@/config/risk";
import { displayScore, portfolioRisk, riskLabel, riskNote, riskPosition } from "./risk";
import { SECTORS } from "./sectors";
import type { EtfBreakdown, HoldingClass, Position } from "./types";

const pos = (ticker: string, value: number, o: Partial<Position> & { assetClass?: HoldingClass } = {}): Position => ({
  id: ticker, ticker, name: ticker, assetClass: "Equities", sector: null, subtype: null, shares: 1, costBasisPerShare: value, currentPrice: value, ...o,
});
const stock = (ticker: string, value: number, sector: string | null) => pos(ticker, value, { sector });
const bond = (ticker: string, value: number) => pos(ticker, value, { assetClass: "Fixed Income", subtype: "Medium-term" });
const alt = (ticker: string, value: number, subtype: string | null) => pos(ticker, value, { assetClass: "Alternatives", subtype });
const bd = (sectors: [string, number][]): EtfBreakdown => ({ sectors: sectors.map(([name, weight]) => ({ name, weight })), countries: [], updatedAt: "2026-10-01T00:00:00.000Z", status: "ok" });
const risk = (positions: Position[], cash = 0, breakdowns: Record<string, EtfBreakdown> = {}, durations: Record<string, number> = {}) => portfolioRisk(positions, cash, breakdowns, durations);

describe("portfolioRisk: one kind of holding at a time", () => {
  it("cash is 1", () => {
    expect(risk([], 1000).score).toBe(1);
  });
  it("a bond fund scores by its own duration band", () => {
    expect(risk([bond("A", 1000)], 0, {}, { A: 0.4 }).score).toBe(1.5); // ultra-short
    expect(risk([bond("A", 1000)], 0, {}, { A: 2 }).score).toBe(2); // short
    expect(risk([bond("A", 1000)], 0, {}, { A: 5 }).score).toBe(2.5); // intermediate
    expect(risk([bond("A", 1000)], 0, {}, { A: 12 }).score).toBe(3); // long
  });
  it("uses the duration as shown on screen at the band edges", () => {
    expect(risk([bond("A", 1000)], 0, {}, { A: 2.96 }).score).toBe(2.5); // shows 3.0: intermediate
    expect(risk([bond("A", 1000)], 0, {}, { A: 0.96 }).score).toBe(2); // shows 1.0: short
    expect(risk([bond("A", 1000)], 0, {}, { A: 2.94 }).score).toBe(2); // shows 2.9: short
  });
  it("alternatives score by type; no type or Other is 3.5", () => {
    expect(risk([alt("A", 1000, "Infrastructure")]).score).toBe(3.2);
    expect(risk([alt("A", 1000, "REITs")]).score).toBe(3.4);
    expect(risk([alt("A", 1000, "Commodities")]).score).toBe(3.8);
    expect(risk([alt("A", 1000, "Crypto")]).score).toBe(5);
    expect(risk([alt("A", 1000, "Other")]).score).toBe(3.5);
    expect(risk([alt("A", 1000, null)]).score).toBe(3.5);
  });
  it("each of the 11 sectors scores as listed", () => {
    for (const sector of SECTORS) expect(risk([stock("S", 1000, sector)]).score, sector).toBe(RISK_SCORES.sectors[sector]);
    expect(RISK_SCORES.sectors["Consumer Staples"]).toBe(3.5);
    expect(RISK_SCORES.sectors["Information Technology"]).toBe(4.8);
    expect(RISK_SCORES.sectors.Energy).toBe(4.6);
  });
});

describe("portfolioRisk: mixing holdings", () => {
  it("averages by market value", () => {
    // $50,000 IT stock (4.8), $30,000 bond fund at 5 yrs (2.5), $10,000 REITs (3.4), $10,000 cash (1)
    const r = risk([stock("NVDA", 50_000, "Information Technology"), bond("BND", 30_000), alt("VNQ", 10_000, "REITs")], 10_000, {}, { BND: 5 });
    expect(r.score).toBeCloseTo((50_000 * 4.8 + 30_000 * 2.5 + 10_000 * 3.4 + 10_000 * 1) / 100_000);
    expect(r.coverage).toBe(1);
    expect(r.missingSector).toEqual([]);
    expect(r.missingDuration).toEqual([]);
  });
  it("splits an equity ETF across its sectors with the shared look-through function", () => {
    // $10,000 ETF: 30% Technology (4.8) and 70% Energy (4.6)
    const r = risk([pos("TECH", 10_000, { sector: "Diversified" })], 0, { TECH: bd([["Information Technology", 0.3], ["Energy", 0.7]]) });
    expect(r.score).toBeCloseTo(0.3 * 4.8 + 0.7 * 4.6);
  });
  it("stays between 1 and 5", () => {
    expect(risk([alt("C", 1000, "Crypto")]).score).toBe(5);
    expect(risk([], 1).score).toBe(1);
  });
  it("is null when nothing can be scored", () => {
    expect(risk([], 0).score).toBeNull();
    expect(risk([stock("X", 1000, null)]).score).toBeNull();
  });
});

describe("portfolioRisk: missing data is left out and listed, never guessed", () => {
  it("leaves out a stock with no sector", () => {
    const r = risk([stock("AAA", 50_000, "Energy"), stock("BBB", 50_000, null)]);
    expect(r.score).toBeCloseTo(4.6);
    expect(r.coverage).toBeCloseTo(0.5);
    expect(r.missingSector).toEqual(["BBB"]);
  });
  it("leaves out an equity ETF with no sector weights", () => {
    const r = risk([stock("AAA", 50_000, "Energy"), pos("ETF", 50_000, { sector: "Diversified" })]);
    expect(r.score).toBeCloseTo(4.6);
    expect(r.missingSector).toEqual(["ETF"]);
  });
  it("leaves out the part of a fund its weights don't cover", () => {
    const r = risk([pos("ETF", 10_000, { sector: "Diversified" })], 0, { ETF: bd([["Energy", 0.6]]) });
    expect(r.score).toBeCloseTo(4.6);
    expect(r.coverage).toBeCloseTo(0.6);
  });
  it("leaves out a bond fund with no duration and lists it", () => {
    const r = risk([bond("A", 50_000), bond("B", 50_000)], 0, {}, { A: 5 });
    expect(r.score).toBeCloseTo(2.5);
    expect(r.coverage).toBeCloseTo(0.5);
    expect(r.missingDuration).toEqual(["B"]);
  });
});

describe("riskNote", () => {
  it("says what the score is built from", () => {
    expect(riskNote({ coverage: 1, missingSector: [], missingDuration: [] })).toBe("Scored from equity sector exposure, bond duration, and alternative type");
  });
  it("only when something is missing, says how much it covers and what", () => {
    const n = riskNote({ coverage: 0.945, missingSector: ["AAA", "BBB"], missingDuration: ["EMB"] });
    expect(n).toBe("Scored from equity sector exposure, bond duration, and alternative type. Based on 94% of your portfolio. No sector data for AAA, BBB; no duration for EMB.");
    expect(riskNote({ coverage: 0.5, missingSector: [], missingDuration: ["EMB"] })).toContain("No duration for EMB.");
  });
  it("shortens a long list", () => {
    expect(riskNote({ coverage: 0.5, missingSector: ["A", "B", "C", "D", "E", "F"], missingDuration: [] })).toContain("No sector data for A, B, C, D and 2 more.");
  });
});

describe("riskLabel", () => {
  it.each([
    [1, "Conservative"],
    [1.4, "Conservative"],
    [1.5, "Moderately Conservative"],
    [2.4, "Moderately Conservative"],
    [3, "Moderate"],
    [3.4, "Moderate"],
    [3.44, "Moderate"],
    [3.46, "Moderately Aggressive"], // shows as 3.5, so it reads Moderately Aggressive
    [3.5, "Moderately Aggressive"],
    [3.6, "Moderately Aggressive"],
    [4.4, "Moderately Aggressive"],
    [4.5, "Aggressive"],
    [5, "Aggressive"],
  ])("score %s is %s", (score, label) => {
    expect(riskLabel(score)).toBe(label);
  });
});

describe("meter helpers", () => {
  it("rounds the displayed score to one decimal", () => {
    expect(displayScore(3.46)).toBe(3.5);
    expect(displayScore(3.84)).toBe(3.8);
  });
  it("places the marker along the 1–5 scale", () => {
    expect(riskPosition(1)).toBe(0);
    expect(riskPosition(3)).toBe(0.5);
    expect(riskPosition(5)).toBe(1);
  });
});
