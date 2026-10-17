import { describe, expect, it } from "vitest";
import type { SectorComparison } from "./calc";
import { sectorInsights } from "./sector-insights";
import type { Sector } from "./sectors";

// portfolio and benchmark are fractions, like compareSectors returns
const row = (sector: Sector, portfolio: number, benchmark: number): SectorComparison => ({
  sector,
  portfolio,
  benchmark,
  difference: portfolio - benchmark,
});

describe("sectorInsights", () => {
  const rows = [
    row("Information Technology", 0.5, 0.3), // over by 20
    row("Financials", 0.05, 0.15), // under by 10
    row("Health Care", 0.2, 0.1), // over by 10
    row("Energy", 0, 0.03), // none, S&P 3%
    row("Real Estate", 0, 0.05), // none, S&P 5%
    row("Utilities", 0.02, 0.02), // in line
    row("Materials", 0.18, 0.35), // under by 17
  ];
  const out = sectorInsights(rows);

  it("classifies each sector", () => {
    const kind = (s: string) => out.find((o) => o.sector === s)!.kind;
    expect(kind("Information Technology")).toBe("over");
    expect(kind("Financials")).toBe("under");
    expect(kind("Energy")).toBe("none");
    expect(kind("Utilities")).toBe("inline");
  });
  it("orders by category, then by size of the gap", () => {
    expect(out.map((o) => o.sector)).toEqual([
      "Information Technology", // over 20
      "Health Care", // over 10
      "Materials", // under 17
      "Financials", // under 10
      "Real Estate", // none, S&P 5%
      "Energy", // none, S&P 3%
      "Utilities", // in line
    ]);
  });
  it("reports gaps in percentage points", () => {
    const tech = out.find((o) => o.sector === "Information Technology")!;
    expect(tech.diffPp).toBeCloseTo(20);
    expect(tech.portfolioPct).toBeCloseTo(50);
    expect(tech.benchmarkPct).toBeCloseTo(30);
  });
  it("treats gaps under 0.05 pp as in line", () => {
    expect(sectorInsights([row("Energy", 0.0301, 0.03)])[0].kind).toBe("inline");
    expect(sectorInsights([row("Energy", 0.0306, 0.03)])[0].kind).toBe("over");
  });
  it("a sector missing from both the portfolio and the benchmark is in line, not 'no holdings'", () => {
    expect(sectorInsights([row("Energy", 0, 0)])[0].kind).toBe("inline");
  });
  it("an empty portfolio has no holdings in every sector", () => {
    const empty = sectorInsights([row("Energy", 0, 0.03), row("Utilities", 0, 0.02)]);
    expect(empty.every((o) => o.kind === "none")).toBe(true);
  });
});
