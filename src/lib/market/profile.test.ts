import { describe, expect, it } from "vitest";
import { equitySector, parseProfile, stockSector } from "./profile";

const aapl = [{ symbol: "AAPL", companyName: "Apple Inc.", price: 343.46, sector: "Technology", isEtf: false, country: null }];
const etf = [{ symbol: "BND", companyName: "Vanguard Total Bond Market ETF", price: 70.82, sector: "Financial Services", isEtf: true, country: null }];

describe("parseProfile", () => {
  it("reads name, price, sector and the ETF flag", () => {
    expect(parseProfile(aapl)).toEqual({ name: "Apple Inc.", price: 343.46, sector: "Technology", isEtf: false, country: null, dividend: null });
  });
  it("reads the last-year dividend per share: a number, zero for a non-payer, null when missing or unusable", () => {
    expect(parseProfile([{ ...aapl[0], lastDividend: 1.06 }])?.dividend).toBe(1.06);
    expect(parseProfile([{ ...aapl[0], lastDividend: 0 }])?.dividend).toBe(0);
    for (const bad of [undefined, null, "1.06", -2, Number.NaN]) expect(parseProfile([{ ...aapl[0], lastDividend: bad }])?.dividend).toBeNull();
  });
  it("treats a fund flag as an ETF too", () => {
    expect(parseProfile([{ ...etf[0], isEtf: false, isFund: true }])?.isEtf).toBe(true);
  });
  it("returns null for empty, error or priceless answers", () => {
    expect(parseProfile([])).toBeNull();
    expect(parseProfile({ "Error Message": "Limit" })).toBeNull();
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile([{ ...aapl[0], price: 0 }])).toBeNull();
    expect(parseProfile([{ ...aapl[0], price: "n/a" }])).toBeNull();
  });
  it("falls back to the ticker when there is no company name", () => {
    expect(parseProfile([{ symbol: "XYZ", price: 5 }])?.name).toBe("XYZ");
  });
});

describe("stockSector", () => {
  it("translates FMP sector names to the app's names", () => {
    expect(stockSector(parseProfile(aapl))).toBe("Information Technology");
    expect(stockSector({ name: "x", price: 1, sector: "Consumer Cyclical", isEtf: false, country: null })).toBe("Consumer Discretionary");
    expect(stockSector({ name: "x", price: 1, sector: "Healthcare", isEtf: false, country: null })).toBe("Health Care");
    expect(stockSector({ name: "x", price: 1, sector: "Energy", isEtf: false, country: null })).toBe("Energy");
  });
  it("gives nothing for ETFs, unknown names and no profile", () => {
    expect(stockSector(parseProfile(etf))).toBeNull();
    expect(stockSector({ name: "x", price: 1, sector: "Space Mining", isEtf: false, country: null })).toBeNull();
    expect(stockSector({ name: "x", price: 1, sector: null, isEtf: false, country: null })).toBeNull();
    expect(stockSector(null)).toBeNull();
  });
});

describe("equitySector", () => {
  it("files an ETF under Diversified", () => {
    expect(equitySector(parseProfile(etf))).toBe("Diversified");
  });
  it("gives a stock its translated sector", () => {
    expect(equitySector(parseProfile(aapl))).toBe("Information Technology");
  });
  it("gives nothing for an unknown sector or no profile", () => {
    expect(equitySector({ name: "x", price: 1, sector: "Space Mining", isEtf: false, country: null })).toBeNull();
    expect(equitySector(null)).toBeNull();
  });
});

describe("country", () => {
  it("reads a stock's headquarters country as an upper-case code", () => {
    expect(parseProfile([{ ...aapl[0], country: "US" }])?.country).toBe("US");
    expect(parseProfile([{ ...aapl[0], country: "tw" }])?.country).toBe("TW");
  });
  it("gives no country for ETFs, missing or invalid values", () => {
    expect(parseProfile([{ ...etf[0], country: "US" }])?.country).toBeNull();
    expect(parseProfile(aapl)?.country).toBeNull();
    expect(parseProfile([{ ...aapl[0], country: "USA" }])?.country).toBeNull();
    expect(parseProfile([{ ...aapl[0], country: "" }])?.country).toBeNull();
  });
});
