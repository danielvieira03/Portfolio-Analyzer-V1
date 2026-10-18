import { describe, expect, it } from "vitest";
import { parseProfile, stockSector } from "./profile";

const aapl = [{ symbol: "AAPL", companyName: "Apple Inc.", price: 343.46, sector: "Technology", isEtf: false }];
const etf = [{ symbol: "BND", companyName: "Vanguard Total Bond Market ETF", price: 70.82, sector: "Financial Services", isEtf: true }];

describe("parseProfile", () => {
  it("reads name, price, sector and the ETF flag", () => {
    expect(parseProfile(aapl)).toEqual({ name: "Apple Inc.", price: 343.46, sector: "Technology", isEtf: false });
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
    expect(stockSector({ name: "x", price: 1, sector: "Consumer Cyclical", isEtf: false })).toBe("Consumer Discretionary");
    expect(stockSector({ name: "x", price: 1, sector: "Healthcare", isEtf: false })).toBe("Health Care");
    expect(stockSector({ name: "x", price: 1, sector: "Energy", isEtf: false })).toBe("Energy");
  });
  it("gives nothing for ETFs, unknown names and no profile", () => {
    expect(stockSector(parseProfile(etf))).toBeNull();
    expect(stockSector({ name: "x", price: 1, sector: "Space Mining", isEtf: false })).toBeNull();
    expect(stockSector({ name: "x", price: 1, sector: null, isEtf: false })).toBeNull();
    expect(stockSector(null)).toBeNull();
  });
});
