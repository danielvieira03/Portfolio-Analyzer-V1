import { describe, expect, it } from "vitest";
import { equitySectorAllocation } from "./sector-allocation";
import type { EtfBreakdown, Position } from "./types";

const pos = (ticker: string, sector: string | null, value: number, assetClass: Position["assetClass"] = "Equities"): Position => ({
  id: ticker,
  ticker,
  name: ticker,
  assetClass,
  sector,
  subtype: null,
  shares: 1,
  costBasisPerShare: value,
  currentPrice: value,
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
  it("weights add up to 1, with a fund that has no data counted as Unclassified", () => {
    const { slices } = equitySectorAllocation([...stocks, pos("VOO", "Diversified", 3400)]);
    expect(slices.reduce((t, s) => t + s.weight, 0)).toBeCloseTo(1);
  });
  it("has no Other slice when there are 7 sectors or fewer", () => {
    const { slices } = equitySectorAllocation(stocks.slice(0, 7));
    expect(slices.some((s) => s.kind === "other")).toBe(false);
    expect(slices).toHaveLength(7);
  });
  it("a fund with no data is its own Unclassified slice, not counted in the top 7", () => {
    const { slices, fundsWithoutData } = equitySectorAllocation([...stocks, pos("VOO", "Diversified", 5000)]);
    expect(slices.filter((s) => s.kind === "sector")).toHaveLength(7);
    expect(slices.find((s) => s.kind === "unclassified")).toMatchObject({ label: "Unclassified", value: 5000 });
    expect(slices.at(-1)!.kind).toBe("other");
    expect(fundsWithoutData).toBe(1);
  });
  it("splits an equity ETF across its sectors: $10,000 at 30% Technology adds $3,000 to Technology", () => {
    const saved: Record<string, EtfBreakdown> = {
      VTEC: { sectors: [{ name: "Information Technology", weight: 0.3 }, { name: "Energy", weight: 0.5 }], countries: [], updatedAt: "2026-10-12T00:00:00.000Z", status: "ok" },
    };
    const { slices, total, oldestBreakdown } = equitySectorAllocation([pos("A", "Energy", 1000), pos("VTEC", "Diversified", 10000)], saved);
    const by = Object.fromEntries(slices.map((s) => [s.label, s.value]));
    expect(total).toBe(11000);
    expect(by["Information Technology"]).toBeCloseTo(3000);
    expect(by.Energy).toBeCloseTo(6000);
    expect(by.Unclassified).toBeCloseTo(2000); // the 20% the weights don't cover
    expect(slices.some((s) => s.label === "Diversified")).toBe(false);
    expect(oldestBreakdown).toBe("2026-10-12T00:00:00.000Z");
  });
  it("puts a stock with no sector yet in Unclassified", () => {
    const { slices } = equitySectorAllocation([pos("A", "Energy", 100), pos("B", null, 300)]);
    expect(slices.map((s) => s.label)).toEqual(["Energy", "Unclassified"]);
  });
  it("ignores non-equities and returns empty without equities", () => {
    expect(equitySectorAllocation([pos("BND", null, 500, "Fixed Income"), pos("GLD", null, 500, "Alternatives")])).toEqual({ total: 0, slices: [], fundsWithoutData: 0, oldestBreakdown: null });
    expect(equitySectorAllocation([])).toEqual({ total: 0, slices: [], fundsWithoutData: 0, oldestBreakdown: null });
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
