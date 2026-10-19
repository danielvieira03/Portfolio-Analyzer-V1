import { describe, expect, it } from "vitest";
import { BREAKDOWN_MAPPING_VERSION } from "@/config/market";
import { buildBreakdown, parseCountryWeights, parseSectorWeights, parseWeight } from "./breakdown";

// Shapes copied from real FMP answers (VOO / VXUS / BND).
const vooSectors = [
  { symbol: "VOO", sector: "Technology", weightPercentage: 38.72 },
  { symbol: "VOO", sector: "Financial Services", weightPercentage: 12.02 },
  { symbol: "VOO", sector: "Consumer Cyclical", weightPercentage: 9.31 },
  { symbol: "VOO", sector: "Healthcare", weightPercentage: 9.29 },
];
const bndSectors = [{ symbol: "BND", sector: "Cash & Others", weightPercentage: 100 }];
const vxusCountries = [
  { country: "Japan", weightPercentage: "16.09%" },
  { country: "Taiwan", weightPercentage: "9.35%" },
  { country: "Korea", weightPercentage: "6.74%" },
  { country: "Supranational", weightPercentage: "1.41%" },
];

describe("parseWeight", () => {
  it("reads numbers and percent strings as fractions", () => {
    expect(parseWeight(38.72)).toBeCloseTo(0.3872);
    expect(parseWeight("93.29%")).toBeCloseTo(0.9329);
    expect(parseWeight("100%")).toBe(1);
    expect(parseWeight(" 7 ")).toBeCloseTo(0.07);
  });
  it("rejects zero, negative, huge and non-numbers", () => {
    for (const v of [0, -3, 101, "abc", "", null, undefined, NaN, {}]) expect(parseWeight(v)).toBeNull();
  });
});

describe("parseSectorWeights", () => {
  it("translates the provider's sector names to the app's", () => {
    const s = parseSectorWeights(vooSectors);
    expect(s.map((x) => x.name)).toEqual(["Information Technology", "Financials", "Consumer Discretionary", "Health Care"]);
    expect(s[0].weight).toBeCloseTo(0.3872);
  });
  it("leaves out names the app doesn't use, such as Cash & Others", () => {
    expect(parseSectorWeights(bndSectors)).toEqual([]);
  });
  it("adds up repeated sectors and survives junk", () => {
    const s = parseSectorWeights([
      { sector: "Technology", weightPercentage: 10 },
      { sector: "Technology", weightPercentage: 5 },
      null,
      "x",
      { sector: 4, weightPercentage: 3 },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].weight).toBeCloseTo(0.15);
    expect(parseSectorWeights({ error: "nope" })).toEqual([]);
  });
});

// Shape copied from the real FMP answer for EWZ (an iShares fund: S&P style sector names).
const ewzSectors = [
  { symbol: "EWZ", sector: "Financials", weightPercentage: 37.38 },
  { symbol: "EWZ", sector: "Energy", weightPercentage: 17.58 },
  { symbol: "EWZ", sector: "Utilities", weightPercentage: 13.25 },
  { symbol: "EWZ", sector: "Materials", weightPercentage: 11.16 },
  { symbol: "EWZ", sector: "Industrials", weightPercentage: 8.57 },
  { symbol: "EWZ", sector: "Consumer Staples", weightPercentage: 5.05 },
  { symbol: "EWZ", sector: "Consumer Discretionary", weightPercentage: 2.57 },
  { symbol: "EWZ", sector: "Cash and/or Derivatives", weightPercentage: 1.62 },
  { symbol: "EWZ", sector: "Communication", weightPercentage: 1.55 },
  { symbol: "EWZ", sector: "Health Care", weightPercentage: 1.26 },
];
const ewzCountries = [
  { country: "Brazil", weightPercentage: "96.04%" },
  { country: "United States", weightPercentage: "1.99%" },
  { country: "Other", weightPercentage: "1.09%" },
  { country: "Netherlands", weightPercentage: "0.87%" },
];

describe("an ETF that uses S&P style sector names (EWZ)", () => {
  it("translates every real sector, leaving out only cash/derivatives", () => {
    const s = parseSectorWeights(ewzSectors);
    expect(s.map((x) => x.name)).toEqual([
      "Financials", "Energy", "Utilities", "Materials", "Industrials", "Consumer Staples", "Consumer Discretionary", "Communication Services", "Health Care",
    ]);
    expect(s.reduce((t, x) => t + x.weight, 0)).toBeCloseTo(0.9838); // 100% minus the 1.62% cash/derivatives
  });
  it("reads Brazil as 96%, leaving out 'Other'", () => {
    const c = parseCountryWeights(ewzCountries);
    expect(c.map((x) => x.code)).toEqual(["BR", "US", "NL"]);
    expect(c[0].weight).toBeCloseTo(0.9604);
  });
  it("matches sector names whatever the capital letters", () => {
    expect(parseSectorWeights([{ sector: "health care", weightPercentage: 10 }, { sector: "INFORMATION TECHNOLOGY", weightPercentage: 5 }]).map((x) => x.name)).toEqual(["Health Care", "Information Technology"]);
  });
});

describe("parseCountryWeights", () => {
  it("turns country names into codes, including the provider's spellings", () => {
    const c = parseCountryWeights(vxusCountries);
    expect(c.map((x) => x.code)).toEqual(["JP", "TW", "KR"]);
    expect(c[0].weight).toBeCloseTo(0.1609);
  });
  it("leaves out names that are not a country (Supranational)", () => {
    expect(parseCountryWeights([{ country: "Supranational", weightPercentage: "1.41%" }])).toEqual([]);
  });
});

describe("buildBreakdown", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  it("is ok with data and stamped with the date", () => {
    const b = buildBreakdown(vooSectors, vxusCountries, now);
    expect(b.status).toBe("ok");
    expect(b.updatedAt).toBe("2026-10-18T12:00:00.000Z");
    expect(b.mapping).toBe(BREAKDOWN_MAPPING_VERSION);
    expect(b.sectors).toHaveLength(4);
    expect(b.countries).toHaveLength(3);
  });
  it("is ok with only one of the two (bond fund: countries but no usable sectors)", () => {
    const b = buildBreakdown(bndSectors, [{ country: "United States", weightPercentage: "93.29%" }], now);
    expect(b.status).toBe("ok");
    expect(b.sectors).toEqual([]);
    expect(b.countries).toEqual([{ code: "US", weight: expect.closeTo(0.9329) }]);
  });
  it("is none when the provider had nothing usable", () => {
    expect(buildBreakdown([], [], now).status).toBe("none");
    expect(buildBreakdown(bndSectors, undefined, now).status).toBe("none");
  });
});
