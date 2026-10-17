import { describe, expect, it } from "vitest";
import { equitySectorAllocation, NO_SECTOR } from "./sector-allocation";
import type { Position } from "./types";

const pos = (ticker: string, sector: string | null, value: number, assetClass: Position["assetClass"] = "Equities"): Position => ({
  id: ticker,
  ticker,
  name: ticker,
  assetClass,
  sector,
  shares: 1,
  costBasisPerShare: value,
  currentPrice: value,
  priceAsOf: new Date("2026-01-01"),
});

const ELEVEN = [
  ["Information Technology", 1100],
  ["Financials", 1000],
  ["Health Care", 900],
  ["Industrials", 800],
  ["Energy", 700],
  ["Utilities", 600],
  ["Consumer Staples", 500],
  ["Materials", 400],
  ["Real Estate", 300],
  ["Communication Services", 200],
  ["Consumer Discretionary", 100],
] as const;
const stocks = ELEVEN.map(([s, v], i) => pos(`S${i}`, s, v));

describe("equitySectorAllocation", () => {
  it("shows the 7 biggest sectors and groups the rest as Other with its members", () => {
    const { slices, total } = equitySectorAllocation(stocks);
    expect(total).toBe(6600);
    expect(slices.map((s) => s.label)).toEqual([
      "Information Technology", "Financials", "Health Care", "Industrials", "Energy", "Utilities", "Consumer Staples", "Other",
    ]);
    const other = slices.at(-1)!;
    expect(other.kind).toBe("other");
    expect(other.members!.map((m) => m.label)).toEqual(["Materials", "Real Estate", "Communication Services", "Consumer Discretionary"]);
    expect(other.value).toBe(1000);
    expect(other.weight).toBeCloseTo(1000 / 6600);
  });
  it("weights add up to 1", () => {
    const { slices } = equitySectorAllocation([...stocks, pos("VOO", "Diversified", 3400)]);
    expect(slices.reduce((t, s) => t + s.weight, 0)).toBeCloseTo(1);
  });
  it("has no Other slice when there are 7 sectors or fewer", () => {
    const { slices } = equitySectorAllocation(stocks.slice(0, 7));
    expect(slices.some((s) => s.kind === "other")).toBe(false);
    expect(slices).toHaveLength(7);
  });
  it("gives broad funds their own Diversified slice, not counted in the top 7", () => {
    const { slices } = equitySectorAllocation([...stocks, pos("VOO", "Diversified", 5000)]);
    expect(slices.filter((s) => s.kind === "sector")).toHaveLength(7);
    expect(slices.find((s) => s.kind === "diversified")).toMatchObject({ label: "Diversified", value: 5000 });
    expect(slices.at(-1)!.kind).toBe("other");
  });
  it("treats stocks with no sector as their own entry", () => {
    const { slices } = equitySectorAllocation([pos("A", "Energy", 100), pos("B", null, 300)]);
    expect(slices.map((s) => s.label)).toEqual([NO_SECTOR, "Energy"]);
  });
  it("ignores non-equities and returns empty without equities", () => {
    expect(equitySectorAllocation([pos("BND", null, 500, "Fixed Income"), pos("GLD", null, 500, "Alternatives")])).toEqual({ total: 0, slices: [] });
    expect(equitySectorAllocation([])).toEqual({ total: 0, slices: [] });
  });
  it("breaks ties alphabetically so the order is stable", () => {
    const { slices } = equitySectorAllocation([pos("A", "Utilities", 100), pos("B", "Energy", 100)]);
    expect(slices.map((s) => s.label)).toEqual(["Energy", "Utilities"]);
  });
  it("adds positions in the same sector together", () => {
    const { slices } = equitySectorAllocation([pos("A", "Energy", 100), pos("B", "Energy", 50)]);
    expect(slices).toHaveLength(1);
    expect(slices[0].value).toBe(150);
  });
});
