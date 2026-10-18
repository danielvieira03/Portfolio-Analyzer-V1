import { describe, expect, it } from "vitest";
import { fundKey, splitKnown, type FundItem, type FundRecord } from "./library";

const lib: FundRecord[] = [
  { ticker: "BND", name: "Vanguard Total Bond", assetClass: "Fixed Income", subtype: "Medium-term", durationYears: 5.7 },
  { ticker: "GLD", name: "SPDR Gold", assetClass: "Alternatives", subtype: "Commodities", durationYears: null },
];
const item = (ticker: string, assetClass: FundItem["assetClass"]): FundItem => ({ ticker, name: ticker, assetClass });

describe("splitKnown", () => {
  it("separates known funds from unknown ones", () => {
    const r = splitKnown([item("BND", "Fixed Income"), item("XYZ", "Fixed Income"), item("GLD", "Alternatives")], lib);
    expect(r.known).toEqual({ "Fixed Income:BND": "Medium-term", "Alternatives:GLD": "Commodities" });
    expect(r.unknown.map((u) => u.ticker)).toEqual(["XYZ"]);
  });
  it("matches tickers regardless of case", () => {
    expect(splitKnown([item("bnd", "Fixed Income")], lib).known).toEqual({ "Fixed Income:BND": "Medium-term" });
  });
  it("ignores a library fund held under a different asset class", () => {
    const r = splitKnown([item("GLD", "Fixed Income")], lib);
    expect(r.known).toEqual({});
    expect(r.unknown).toHaveLength(1);
  });
  it("handles an empty library", () => {
    expect(splitKnown([item("BND", "Fixed Income")], []).unknown).toHaveLength(1);
  });
});

describe("fundKey", () => {
  it("upper-cases the ticker", () => expect(fundKey("Fixed Income", "bnd")).toBe("Fixed Income:BND"));
});
