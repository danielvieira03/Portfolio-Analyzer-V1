import { describe, expect, it } from "vitest";
import { FALLBACK_BENCHMARK } from "@/lib/market/benchmark";
import { allocationByClass, compareSectors, summarize } from "@/lib/portfolio/calc";
import { portfolioIncome } from "@/lib/portfolio/income";
import { bondDurations, demoDoc, emptyDoc, type PortfolioDoc } from "@/lib/portfolio/ledger";
import { displayScore, portfolioRisk, riskLabel } from "@/lib/portfolio/risk";
import type { Position } from "@/lib/portfolio/types";
import { buildPortfolioSnapshot, snapshotText } from "./snapshot";

const stock = (n: number, o: Partial<Position> = {}): Position => ({
  id: `s${n}`, ticker: `S${n}`, name: `Stock ${n}`, assetClass: "Equities", sector: "Energy", subtype: null, shares: 10, costBasisPerShare: 90, currentPrice: 100, dividend: 1, ...o,
});
const docWith = (holdings: Position[], cash = 0): PortfolioDoc => ({ ...emptyDoc(), holdings, cash });

describe("buildPortfolioSnapshot", () => {
  it("is null for an empty portfolio (the chat asks the visitor to add holdings)", () => {
    expect(buildPortfolioSnapshot(emptyDoc())).toBeNull();
    expect(snapshotText(emptyDoc())).toBeNull();
    expect(buildPortfolioSnapshot(docWith([], 5000))).toBeNull();
  });

  it("uses the numbers the shared functions give, not its own", () => {
    for (const id of ["conservative", "global", "growth"] as const) {
      const doc = demoDoc(id);
      const snap = buildPortfolioSnapshot(doc)!;
      const summary = summarize(doc.holdings, doc.cash);
      const risk = portfolioRisk(doc.holdings, doc.cash, doc.etfBreakdowns, bondDurations(doc));
      const income = portfolioIncome(doc.holdings, doc.cash);

      expect(snap.totals.portfolioValue).toBeCloseTo(summary.totalValue, 2);
      expect(snap.totals.holdingCount).toBe(doc.holdings.length);
      expect(snap.risk.scoreOutOf5).toBe(displayScore(risk.score!));
      expect(snap.risk.riskType).toBe(riskLabel(risk.score!));
      expect(snap.income.expectedAnnual).toBeCloseTo(income.total.expected, 2);
      expect(snap.income.lowAnnual).toBeCloseTo(income.total.low, 2);
      expect(snap.income.highAnnual).toBeCloseTo(income.total.high, 2);
      expect(snap.allocationByAssetClass.map((s) => s.assetClass)).toEqual(allocationByClass(doc.holdings, doc.cash).map((s) => s.assetClass));
      const sectors = compareSectors(doc.holdings, FALLBACK_BENCHMARK.weights, doc.etfBreakdowns);
      expect(snap.sectorsVsSp500.rows).toHaveLength(sectors.length);
      expect(snap.sectorsVsSp500.rows[0].sp500Pct).toBeCloseTo(sectors[0].benchmark * 100, 1);
    }
  });

  it("lists holdings biggest first with weights that include cash", () => {
    const snap = buildPortfolioSnapshot(docWith([stock(1, { shares: 1 }), stock(2, { shares: 9 })], 1000))!;
    expect(snap.holdings.map((h) => h.ticker)).toEqual(["S2", "S1"]);
    expect(snap.holdings[0].value).toBe(900);
    expect(snap.holdings[0].weightPct).toBe(45); // 900 of 2,000 (1,000 of it cash)
    expect(snap.smallerHoldings).toBeNull();
  });

  it("lists the biggest 40 holdings and sums the rest", () => {
    const many = Array.from({ length: 45 }, (_, i) => stock(i, { shares: 100 - i }));
    const snap = buildPortfolioSnapshot(docWith(many))!;
    expect(snap.holdings).toHaveLength(40);
    expect(snap.smallerHoldings?.count).toBe(5);
    expect(snap.totals.holdingCount).toBe(45);
  });

  it("says what is missing instead of guessing", () => {
    const snap = buildPortfolioSnapshot(docWith([stock(1, { sector: null }), stock(2, { dividend: null }), { ...stock(3), assetClass: "Fixed Income", sector: null, ticker: "ZZBOND" }]))!;
    expect(snap.risk.missingSector).toEqual(["S1"]);
    expect(snap.risk.missingDuration).toEqual(["ZZBOND"]);
    expect(snap.bondDuration.averageYears).toBeNull();
    const notes = snap.dataNotes.join(" ");
    expect(notes).toContain("No sector data for: S1");
    expect(notes).toContain("No duration for: ZZBOND");
    expect(notes).toContain("Income not available yet for: S2");
  });

  it("compares against the benchmark it is given (and says as of when)", () => {
    const fresh = { asOf: "2030-01-02", weights: { ...FALLBACK_BENCHMARK.weights, "Information Technology": 50, Financials: 0.5 } };
    const snap = buildPortfolioSnapshot(demoDoc("global"), fresh)!;
    expect(snap.sectorsVsSp500.benchmarkAsOf).toBe("2030-01-02");
    expect(snap.sectorsVsSp500.rows.find((r) => r.sector === "Information Technology")!.sp500Pct).toBe(50);
    expect(buildPortfolioSnapshot(demoDoc("global"))!.sectorsVsSp500.benchmarkAsOf).toBe(FALLBACK_BENCHMARK.asOf);
  });

  it("flags a demo portfolio", () => {
    expect(buildPortfolioSnapshot(demoDoc("global"))!.dataNotes[0]).toMatch(/demo portfolio/);
  });

  it("stays small enough to send with every question", () => {
    const many = Array.from({ length: 45 }, (_, i) => stock(i, { shares: 100 - i }));
    expect(snapshotText(docWith(many))!.length).toBeLessThan(20_000);
    expect(snapshotText(demoDoc("global"))!.length).toBeLessThan(20_000);
  });
});
