import { describe, expect, it } from "vitest";
import {
  allocationByClass,
  compareSectors,
  costValue,
  gainLoss,
  gainLossPct,
  marketValue,
  mergePositions,
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
  subtype: null,
  shares: 10,
  costBasisPerShare: 100,
  currentPrice: 150,
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
  });
  it("handles an empty portfolio", () => {
    expect(summarize([], 0)).toMatchObject({ totalValue: 0, gainLossPct: 0 });
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
  it("splits an equity ETF across its sectors, shares of the part that has a sector", () => {
    const saved = { ETF: { sectors: [{ name: "Information Technology", weight: 0.5 }, { name: "Financials", weight: 0.3 }], countries: [], updatedAt: "2026-10-12T00:00:00.000Z", status: "ok" as const } };
    const rows = compareSectors([A, B, ETF], bench, saved); // tech 1500 + 600, financials 500 + 360, 240 unclassified
    const tech = rows.find((r) => r.sector === "Information Technology")!;
    const fin = rows.find((r) => r.sector === "Financials")!;
    expect(tech.portfolio).toBeCloseTo(2100 / 2960);
    expect(fin.portfolio).toBeCloseTo(860 / 2960);
    expect(rows.reduce((t, r) => t + r.portfolio, 0)).toBeCloseTo(1); // only the part that has a sector counts
  });
  it("never counts bond funds in the sector comparison, even with saved data", () => {
    const saved = { BND: { sectors: [{ name: "Energy", weight: 1 }], countries: [], updatedAt: "2026-10-12T00:00:00.000Z", status: "ok" as const } };
    expect(compareSectors([A, B, BOND], bench, saved)).toEqual(compareSectors([A, B], bench));
  });
});

describe("topHoldings", () => {
  it("ranks by value and reports share of the whole portfolio", () => {
    const top = topHoldings([B, A, ETF], 800, 2); // total = 500 + 1500 + 1200 + 800 = 4000
    expect(top.map((t) => t.position.ticker)).toEqual(["A", "ETF"]);
    expect(top[0].weight).toBeCloseTo(0.375);
  });
});

describe("mergePositions", () => {
  const old = { name: "Apple", sector: "Information Technology", subtype: null, shares: 10, costBasisPerShare: 100, currentPrice: 150 };
  const fresh = { name: "Apple Inc.", sector: null, subtype: null, shares: 30, costBasisPerShare: 200, currentPrice: 210 };
  it("adds shares and averages the cost by share count", () => {
    const m = mergePositions(old, fresh);
    expect(m.shares).toBe(40);
    expect(m.costBasisPerShare).toBeCloseTo(175); // (10*100 + 30*200) / 40
  });
  it("takes the newer price, keeps existing name and sector", () => {
    const m = mergePositions(old, fresh);
    expect(m.currentPrice).toBe(210);
    expect(m.name).toBe("Apple");
    expect(m.sector).toBe("Information Technology");
  });
  it("keeps an existing maturity/type, or takes the new one when there was none", () => {
    expect(mergePositions({ ...old, subtype: "Short-term" }, { ...fresh, subtype: "Long-term" }).subtype).toBe("Short-term");
    expect(mergePositions(old, { ...fresh, subtype: "Long-term" }).subtype).toBe("Long-term");
  });
  it("keeps total cost unchanged by merging (value in = value out)", () => {
    const m = mergePositions(old, fresh);
    expect(m.shares * m.costBasisPerShare).toBeCloseTo(10 * 100 + 30 * 200);
  });
});
