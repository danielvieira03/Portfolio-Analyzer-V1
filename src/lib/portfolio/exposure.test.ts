import { describe, expect, it } from "vitest";
import { lookThroughExposure, UNCLASSIFIED } from "./exposure";
import type { EtfBreakdown, HoldingClass, Position } from "./types";

const pos = (
  ticker: string,
  value: number,
  o: Partial<Position> & { assetClass?: HoldingClass } = {},
): Position => ({
  id: ticker,
  ticker,
  name: ticker,
  assetClass: "Equities",
  sector: null,
  subtype: null,
  shares: 1,
  costBasisPerShare: value,
  currentPrice: value,
  ...o,
});
const etf = (ticker: string, value: number, o: Partial<Position> = {}) => pos(ticker, value, { sector: "Diversified", ...o });
const bd = (sectors: [string, number][], countries: [string, number][], o: Partial<EtfBreakdown> = {}): EtfBreakdown => ({
  sectors: sectors.map(([name, weight]) => ({ name, weight })),
  countries: countries.map(([code, weight]) => ({ code, weight })),
  updatedAt: "2026-10-01T00:00:00.000Z",
  status: "ok",
  ...o,
});
const val = (rows: { key: string; value: number }[], key: string) => rows.find((r) => r.key === key)?.value ?? 0;

describe("lookThroughExposure", () => {
  it("splits $10,000 in a fund that is 30% Technology: $3,000 to Technology", () => {
    const x = lookThroughExposure([etf("VTEC", 10000)], { VTEC: bd([["Information Technology", 0.3], ["Financials", 0.7]], [["US", 1]]) });
    expect(val(x.sector.rows, "Information Technology")).toBeCloseTo(3000);
    expect(val(x.sector.rows, "Financials")).toBeCloseTo(7000);
    expect(x.sector.unclassified.value).toBe(0);
    expect(x.country.rows).toHaveLength(1);
    expect(x.country.rows[0]).toMatchObject({ key: "US", label: "United States", value: 10000, weight: 1 });
  });

  it("counts individual stocks 100% to their own sector and country", () => {
    const x = lookThroughExposure([pos("AAPL", 500, { sector: "Information Technology", country: "US" }), pos("ASML", 500, { sector: "Information Technology", country: "NL" })], {});
    expect(x.sector.rows).toEqual([{ key: "Information Technology", label: "Information Technology", value: 1000, weight: 1 }]);
    expect(x.country.rows.map((r) => r.key)).toEqual(["NL", "US"]);
  });

  it("mixes stocks and funds, weights are shares of everything counted", () => {
    const x = lookThroughExposure(
      [pos("AAPL", 1000, { sector: "Information Technology", country: "US" }), etf("VOO", 1000)],
      { VOO: bd([["Information Technology", 0.4], ["Energy", 0.6]], [["US", 1]]) },
    );
    expect(x.sector.total).toBe(2000);
    expect(val(x.sector.rows, "Information Technology")).toBeCloseTo(1400);
    expect(x.sector.rows[0].weight).toBeCloseTo(0.7);
    expect(val(x.country.rows, "US")).toBeCloseTo(2000);
  });

  it("puts the part under 100% in Unclassified", () => {
    const x = lookThroughExposure([etf("F", 1000)], { F: bd([["Energy", 0.6]], [["JP", 0.25]]) });
    expect(x.sector.unclassified.value).toBeCloseTo(400);
    expect(x.sector.unclassified.weight).toBeCloseTo(0.4);
    expect(x.country.unclassified.value).toBeCloseTo(750);
    expect(UNCLASSIFIED).toBe("Unclassified");
  });

  it("a fund with no record, or no data at the provider, is all Unclassified and counted as without data", () => {
    const x = lookThroughExposure([etf("A", 600), etf("B", 400)], { B: bd([], [], { status: "none" }) });
    expect(x.sector.rows).toEqual([]);
    expect(x.sector.unclassified).toEqual({ value: 1000, weight: 1 });
    expect(x.country.unclassified.value).toBe(1000);
    expect(x.sector.fundsWithoutData).toBe(2);
    expect(x.sector.oldestBreakdown).toBeNull();
  });

  it("a fund can have sector data but no country data (dimensions are independent)", () => {
    const x = lookThroughExposure([etf("F", 1000)], { F: bd([["Energy", 1]], []) });
    expect(x.sector.unclassified.value).toBe(0);
    expect(x.country.unclassified.value).toBe(1000);
  });

  it("scales weights that add up to slightly more than 100%", () => {
    const x = lookThroughExposure([etf("F", 1000)], { F: bd([["Energy", 0.51], ["Utilities", 0.51]], []) });
    expect(x.sector.classified).toBeCloseTo(1000);
    expect(x.sector.unclassified.value).toBe(0);
    expect(val(x.sector.rows, "Energy")).toBeCloseTo(500);
  });

  it("a stock with no sector or country yet is Unclassified, not dropped", () => {
    const x = lookThroughExposure([pos("NEW", 300)], {});
    expect(x.sector.unclassified.value).toBe(300);
    expect(x.country.unclassified.value).toBe(300);
    expect(x.sector.fundsWithoutData).toBe(0);
  });

  it("bond funds count in the country view only, never in the sector view (and are not Unclassified there)", () => {
    const bond = pos("BND", 1000, { assetClass: "Fixed Income" });
    const stock = pos("AAPL", 1000, { sector: "Information Technology", country: "US" });
    const saved = { BND: bd([], [["US", 0.9], ["CA", 0.1]]) };
    const x = lookThroughExposure([bond, stock], saved);
    expect(x.sector.total).toBe(1000);
    expect(x.sector.unclassified.value).toBe(0);
    expect(x.sector.rows.map((r) => r.key)).toEqual(["Information Technology"]);
    expect(x.country.total).toBe(2000);
    expect(val(x.country.rows, "US")).toBeCloseTo(1900);
    expect(val(x.country.rows, "CA")).toBeCloseTo(100);
  });

  it("a bond fund with no data is Unclassified in the country view, not in sectors; alternatives are out unless asked", () => {
    const bond = pos("XBD", 400, { assetClass: "Fixed Income" });
    const gold = pos("GLD", 500, { assetClass: "Alternatives" });
    const x = lookThroughExposure([bond, gold], {});
    expect(x.sector.total).toBe(0);
    expect(x.country.total).toBe(400);
    expect(x.country.unclassified.value).toBe(400);
    expect(x.country.fundsWithoutData).toBe(1);
    const all = lookThroughExposure([bond, gold], {}, { countryClasses: ["Equities", "Fixed Income", "Alternatives"], sectorClasses: ["Alternatives"] });
    expect(all.country.total).toBe(900);
    expect(all.sector.total).toBe(500);
  });

  it("finds breakdowns by upper-case ticker and reports the oldest one used", () => {
    const x = lookThroughExposure([etf("voo", 100), etf("QQQ", 100)], {
      VOO: bd([["Energy", 1]], [], { updatedAt: "2026-10-10T00:00:00.000Z" }),
      QQQ: bd([["Energy", 1]], [], { updatedAt: "2026-09-01T00:00:00.000Z" }),
    });
    expect(x.sector.unclassified.value).toBe(0);
    expect(x.sector.oldestBreakdown).toBe("2026-09-01T00:00:00.000Z");
  });

  it("sorts biggest first and handles an empty portfolio", () => {
    const x = lookThroughExposure([etf("F", 1000)], { F: bd([["Energy", 0.2], ["Utilities", 0.8]], []) });
    expect(x.sector.rows.map((r) => r.key)).toEqual(["Utilities", "Energy"]);
    const empty = lookThroughExposure([], {});
    expect(empty.sector).toEqual({ total: 0, classified: 0, unclassified: { value: 0, weight: 0 }, rows: [], fundsWithoutData: 0, oldestBreakdown: null });
  });
});

describe("lookThroughExposure: duration view", () => {
  const bond = (ticker: string, value: number) => pos(ticker, value, { assetClass: "Fixed Income" });
  it("is the market-value-weighted average duration of the bond funds that have one", () => {
    // $60,000 at 2 years, $40,000 at 7 years: (60*2 + 40*7) / 100 = 4.0
    const d = lookThroughExposure([bond("A", 60_000), bond("B", 40_000)], {}, { durations: { A: 2, B: 7 } }).duration;
    expect(d.average).toBeCloseTo(4.0);
    expect(d.total).toBe(100_000);
    expect(d.covered).toBe(100_000);
    expect(d.rows.map((r) => [r.ticker, r.years])).toEqual([["A", 2], ["B", 7]]);
    expect(d.withoutDuration).toEqual([]);
  });
  it("leaves a fund with no duration out of the average and lists it", () => {
    const d = lookThroughExposure([bond("A", 60_000), bond("B", 40_000)], {}, { durations: { A: 2 } }).duration;
    expect(d.average).toBeCloseTo(2);
    expect(d.covered).toBe(60_000);
    expect(d.total).toBe(100_000);
    expect(d.withoutDuration).toEqual([{ ticker: "B", name: "B" }]);
  });
  it("counts only Fixed Income: stocks, ETFs, alternatives and cash are not part of it", () => {
    const positions = [bond("A", 50_000), pos("VOO", 100_000, { sector: "Diversified" }), pos("GLD", 30_000, { assetClass: "Alternatives" })];
    const d = lookThroughExposure(positions, {}, { durations: { A: 3, VOO: 9, GLD: 9 } }).duration;
    expect(d.total).toBe(50_000);
    expect(d.average).toBeCloseTo(3);
  });
  it("has no average when there are no bond funds, or none has a duration", () => {
    expect(lookThroughExposure([pos("AAPL", 10_000)], {}, { durations: { AAPL: 5 } }).duration).toMatchObject({ average: null, total: 0, rows: [] });
    const none = lookThroughExposure([bond("A", 10_000)], {}).duration;
    expect(none.average).toBeNull();
    expect(none.withoutDuration).toHaveLength(1);
  });
  it("can be pointed at another scope through the option", () => {
    const d = lookThroughExposure([pos("GLD", 30_000, { assetClass: "Alternatives" })], {}, { durations: { GLD: 4 }, durationClasses: ["Alternatives"] }).duration;
    expect(d.average).toBeCloseTo(4);
  });
  it("leaves the sector and country views as they were", () => {
    const r = lookThroughExposure([pos("AAPL", 10_000, { sector: "Information Technology", country: "US" }), bond("A", 5_000)], {}, { durations: { A: 3 } });
    expect(r.sector.total).toBe(10_000);
    expect(r.country.total).toBe(15_000);
  });
});

describe("lookThroughExposure: duration contributions", () => {
  const bond = (ticker: string, value: number) => pos(ticker, value, { assetClass: "Fixed Income" });
  it("splits the average into what each fund adds", () => {
    // $60,000 at 2 years (weight 0.6, adds 1.2) and $40,000 at 7 years (weight 0.4, adds 2.8): average 4.0
    const d = lookThroughExposure([bond("A", 60_000), bond("B", 40_000)], {}, { durations: { A: 2, B: 7 } }).duration;
    expect(d.rows.map((r) => [r.ticker, r.weight, r.contribution])).toEqual([["A", expect.closeTo(0.6), expect.closeTo(1.2)], ["B", expect.closeTo(0.4), expect.closeTo(2.8)]]);
    expect(d.rows.reduce((t, r) => t + r.contribution, 0)).toBeCloseTo(d.average!);
    expect(d.rows.reduce((t, r) => t + r.weight, 0)).toBeCloseTo(1);
  });
  it("takes the weights from the funds that have a duration only", () => {
    const d = lookThroughExposure([bond("A", 60_000), bond("B", 40_000), bond("C", 100_000)], {}, { durations: { A: 2, B: 7 } }).duration;
    expect(d.rows.map((r) => r.weight)).toEqual([expect.closeTo(0.6), expect.closeTo(0.4)]);
  });
});
