import { describe, expect, it } from "vitest";
import { subtypeAllocation } from "./subtype-allocation";
import type { Position } from "./types";

const pos = (ticker: string, assetClass: Position["assetClass"], subtype: string | null, value: number): Position => ({
  id: ticker, ticker, name: ticker, assetClass, sector: null, subtype,
  shares: 1, costBasisPerShare: value, currentPrice: value, priceAsOf: new Date("2026-01-01"),
});

const bonds = [
  pos("L", "Fixed Income", "Long-term", 300),
  pos("S", "Fixed Income", "Short-term", 100),
  pos("M", "Fixed Income", "Medium-term", 500),
  pos("U", "Fixed Income", null, 100),
];

describe("subtypeAllocation", () => {
  it("orders maturities short to long, with 'Not specified' last, and weights add to 1", () => {
    const { slices, total } = subtypeAllocation(bonds, "Fixed Income");
    expect(total).toBe(1000);
    expect(slices.map((s) => s.label)).toEqual(["Short-term", "Medium-term", "Long-term", "Not specified"]);
    expect(slices.reduce((t, s) => t + s.weight, 0)).toBeCloseTo(1);
    expect(slices[1].weight).toBeCloseTo(0.5);
  });
  it("counts a missing or unknown value as 'Not specified', merged with an explicit one", () => {
    const { slices } = subtypeAllocation([pos("A", "Fixed Income", null, 100), pos("B", "Fixed Income", "Not specified", 50), pos("C", "Fixed Income", "Weird", 50)], "Fixed Income");
    expect(slices).toEqual([{ label: "Not specified", value: 200, weight: 1 }]);
  });
  it("can sort alternatives by size with 'Other' last", () => {
    const alts = [pos("O", "Alternatives", "Other", 900), pos("G", "Alternatives", "Commodities", 100), pos("R", "Alternatives", "REITs", 300)];
    expect(subtypeAllocation(alts, "Alternatives", true).slices.map((s) => s.label)).toEqual(["REITs", "Commodities", "Other"]);
  });
  it("ignores other asset classes and is empty when there are none", () => {
    expect(subtypeAllocation(bonds, "Alternatives")).toEqual({ total: 0, slices: [] });
    expect(subtypeAllocation([], "Fixed Income")).toEqual({ total: 0, slices: [] });
  });
});
