import { describe, expect, it } from "vitest";
import { countryExposure } from "./country-exposure";
import type { Position } from "./types";

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
  it("leaves out broad funds (Diversified), bond funds, alternatives and anything that isn't Equities", () => {
    const r = countryExposure([
      stock("A", "US", 10, 100),
      stock("VOO", "US", 10, 500, { sector: "Diversified" }),
      stock("EWZ", "BR", 10, 30, { sector: "Diversified" }), // a one-country fund: not included in this stocks-only card
      stock("BND", "US", 10, 70, { assetClass: "Fixed Income", sector: null }),
      stock("GLD", "US", 10, 300, { assetClass: "Alternatives", sector: null }),
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(1000);
    expect(r.withoutCountry).toBe(0);
  });
  it("counts stocks with no country yet, without letting them change the percentages", () => {
    const r = countryExposure([stock("A", "US", 10, 100), stock("X", null, 10, 999), stock("Y", null, 1, 1)]);
    expect(r.withoutCountry).toBe(2);
    expect(r.rows).toEqual([{ code: "US", name: "United States", value: 1000, weight: 1 }]);
  });
  it("is empty when there are no stocks with a country", () => {
    expect(countryExposure([])).toEqual({ total: 0, rows: [], withoutCountry: 0 });
    expect(countryExposure([stock("X", null, 1, 1)])).toEqual({ total: 0, rows: [], withoutCountry: 1 });
  });
  it("ties break alphabetically by country name", () => {
    const r = countryExposure([stock("A", "NL", 1, 100), stock("B", "DE", 1, 100)]);
    expect(r.rows.map((x) => x.code)).toEqual(["DE", "NL"]);
  });
});
