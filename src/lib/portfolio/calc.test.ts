import { describe, expect, it } from "vitest";
import {
  allocationByClass,
  compareSectors,
  costValue,
  gainLoss,
  gainLossPct,
  marketValue,
  summarize,
  topHoldings,
  weight,
} from "./calc";
import type { Position } from "./types";

const pos = (o: Partial<Position> & Pick<Position, "ticker">): Position => ({
  id: o.ticker,
  name: o.ticker,
  assetClass: "Equities",
  sector: "Information Technology",
  shares: 10,
  costBasisPerShare: 100,
  currentPrice: 150,
  priceAsOf: new Date("2026-01-01"),
  ...o,
});

const A = pos({ ticker: "A" }); // value 1500, cost 1000, +500
const B = pos({ ticker: "B", sector: "Financials", currentPrice: 50 }); // value 500, cost 1000, -500
const ETF = pos({ ticker: "ETF", sector: "Diversified", shares: 100, costBasisPerShare: 10, currentPrice: 12 }); // 1200 / 1000
const BOND = pos({ ticker: "BND", assetClass: "Fixed Income", sector: null, shares: 20, costBasisPerShare: 50, currentPrice: 40 }); // 800 / 1000

describe("single position", () => {
  it("computes value, cost and gain/loss", () => {
    expect(marketValue(A)).toBe(1500);
    expect(costValue(A)).toBe(1000);
    expect(gainLoss(A)).toBe(500);
    expect(gainLossPct(A)).toBeCloseTo(0.5);
    expect(gainLoss(B)).toBe(-500);
    expect(gainLossPct(B)).toBeCloseTo(-0.5);
  });
  it("returns 0% when cost is zero", () => {
    expect(gainLossPct(pos({ ticker: "Z", costBasisPerShare: 0 }))).toBe(0);
  });
});

describe("weight", () => {
  it("is part over total, and 0 for an empty total", () => {
    expect(weight(25, 100)).toBe(0.25);
    expect(weight(5, 0)).toBe(0);
  });
});

describe("summarize", () => {
  it("includes cash in value and cost so value - cost = gain/loss", () => {
    const s = summarize([A, B], 1000);
    expect(s.totalValue).toBe(3000);
    expect(s.totalCost).toBe(3000);
    expect(s.gainLoss).toBe(0);
    expect(s.holdingCount).toBe(2);
  });
  it("handles an empty portfolio", () => {
    expect(summarize([], 0)).toMatchObject({ totalValue: 0, gainLossPct: 0, holdingCount: 0 });
  });
});

describe("allocationByClass", () => {
  it("weights each class against the whole portfolio, cash included", () => {
    const slices = allocationByClass([A, BOND], 700); // 1500 + 800 + 700 = 3000
    expect(slices.map((s) => s.assetClass)).toEqual(["Equities", "Fixed Income", "Cash"]);
    expect(slices[0].weight).toBeCloseTo(0.5);
    expect(slices.reduce((t, s) => t + s.weight, 0)).toBeCloseTo(1);
  });
  it("drops empty classes", () => {
    expect(allocationByClass([A], 0).map((s) => s.assetClass)).toEqual(["Equities"]);
  });
});

describe("compareSectors", () => {
  const bench = {
    "Information Technology": 30,
    "Communication Services": 10,
    Financials: 20,
    "Consumer Discretionary": 10,
    "Health Care": 10,
    Industrials: 10,
    "Consumer Staples": 5,
    Energy: 2,
    Utilities: 1,
    "Real Estate": 1,
    Materials: 1,
  };
  it("ignores diversified funds and non-equities, and shows over/underweight", () => {
    const rows = compareSectors([A, B, ETF, BOND], bench); // tagged total = 2000
    const tech = rows.find((r) => r.sector === "Information Technology")!;
    const fin = rows.find((r) => r.sector === "Financials")!;
    expect(tech.portfolio).toBeCloseTo(0.75);
    expect(tech.difference).toBeCloseTo(0.45); // overweight
    expect(fin.portfolio).toBeCloseTo(0.25);
    expect(fin.difference).toBeCloseTo(0.05);
    expect(rows).toHaveLength(11);
  });
});

describe("topHoldings", () => {
  it("ranks by value and reports share of the whole portfolio", () => {
    const top = topHoldings([B, A, ETF], 800, 2); // total = 500 + 1500 + 1200 + 800 = 4000
    expect(top.map((t) => t.position.ticker)).toEqual(["A", "ETF"]);
    expect(top[0].weight).toBeCloseTo(0.375);
  });
});
