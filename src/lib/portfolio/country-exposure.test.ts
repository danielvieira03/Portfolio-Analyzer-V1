import { describe, expect, it } from "vitest";
import { countryExposure } from "./country-exposure";
import type { EtfBreakdown, Position } from "./types";

const stock = (ticker: string, country: string | null, shares: number, price: number, o: Partial<Position> = {}): Position => ({
  id: ticker, ticker, name: ticker, assetClass: "Equities", sector: "Energy", subtype: null,
  shares, costBasisPerShare: price, currentPrice: price, country, ...o,
});

describe("countryExposure", () => {
  it("shares individual stocks by country, biggest first, adding up to 100%", () => {
    const r = countryExposure([stock("A", "US", 10, 100), stock("B", "US", 10, 100), stock("C", "NL", 10, 100), stock("D", "JP", 10, 50)]);
    expect(r.rows.map((x) => x.code)).toEqual(["US", "NL", "JP"]);
    expect(r.rows[0]).toMatchObject({ name: "United States", value: 2000 });
    expect(r.rows[0].weight).toBeCloseTo(2000 / 3500);
    expect(r.rows.reduce((t, x) => t + x.weight, 0)).toBeCloseTo(1);
    expect(r.total).toBe(3500);
  });
  it("leaves out alternatives and cash-like things that aren't Equities or Fixed Income", () => {
    const r = countryExposure([stock("A", "US", 10, 100), stock("GLD", "US", 10, 300, { assetClass: "Alternatives", sector: null })]);
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(1000);
    expect(r.unclassified).toEqual({ value: 0, weight: 0 });
  });
  it("splits equity ETFs and bond funds by their country weights", () => {
    const saved: Record<string, EtfBreakdown> = {
      VXUS: { sectors: [], countries: [{ code: "JP", weight: 0.5 }, { code: "TW", weight: 0.5 }], updatedAt: "2026-10-12T00:00:00.000Z", status: "ok" },
      BND: { sectors: [], countries: [{ code: "US", weight: 0.9 }, { code: "CA", weight: 0.1 }], updatedAt: "2026-10-14T00:00:00.000Z", status: "ok" },
    };
    const r = countryExposure(
      [stock("VXUS", null, 10, 100, { sector: "Diversified" }), stock("BND", null, 10, 100, { assetClass: "Fixed Income", sector: null })],
      saved,
    );
    expect(r.rows.map((x) => [x.code, Math.round(x.value)])).toEqual([["US", 900], ["JP", 500], ["TW", 500], ["CA", 100]]);
    expect(r.rows.reduce((t, x) => t + x.weight, 0)).toBeCloseTo(1);
    expect(r.oldestBreakdown).toBe("2026-10-12T00:00:00.000Z");
  });
  it("reports the part with no country separately, without changing the percentages", () => {
    const r = countryExposure([stock("A", "US", 10, 100), stock("X", null, 10, 100), stock("F", null, 10, 100, { sector: "Diversified" })]);
    expect(r.rows).toEqual([{ code: "US", name: "United States", value: 1000, weight: 1 }]);
    expect(r.unclassified.value).toBe(2000);
    expect(r.unclassified.weight).toBeCloseTo(2000 / 3000);
    expect(r.fundsWithoutData).toBe(1);
  });
  it("is empty when nothing has a country", () => {
    expect(countryExposure([])).toEqual({ total: 0, rows: [], unclassified: { value: 0, weight: 0 }, fundsWithoutData: 0, oldestBreakdown: null });
    expect(countryExposure([stock("X", null, 1, 1)]).rows).toEqual([]);
  });
  it("ties break alphabetically by country name", () => {
    const r = countryExposure([stock("A", "NL", 1, 100), stock("B", "DE", 1, 100)]);
    expect(r.rows.map((x) => x.code)).toEqual(["DE", "NL"]);
  });
});
