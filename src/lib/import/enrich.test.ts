import { describe, expect, it } from "vitest";
import type { HoldingInput } from "@/lib/holdings/schema";
import type { MarketProfile } from "@/lib/market/profile";
import { addClaudeSectors, checkSector, marketExtras, marketLookupTickers, sectorsForClaude, stillBlank, withExtras } from "./enrich";

const row = (o: Partial<HoldingInput> & { ticker: string }): HoldingInput => ({
  name: o.ticker, assetClass: "Equities", sector: null, subtype: null, country: null, dividend: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, ...o,
});
const profile = (o: Partial<MarketProfile>): MarketProfile => ({ name: "X", price: 10, sector: null, isEtf: false, country: null, ...o });

describe("marketLookupTickers", () => {
  it("asks about equity rows missing a sector or country, once each, upper-case", () => {
    const rows = [
      row({ ticker: "aapl" }),
      row({ ticker: "AAPL" }),
      row({ ticker: "MSFT", sector: "Information Technology", country: "US" }), // complete: no need
      row({ ticker: "BND", assetClass: "Fixed Income" }), // bonds are not asked
    ];
    expect(marketLookupTickers(rows)).toEqual(["AAPL"]);
  });
});

describe("marketExtras", () => {
  it("gives a stock its translated sector and country", () => {
    const x = marketExtras([row({ ticker: "AAPL" })], { AAPL: profile({ sector: "Technology", country: "US" }) });
    expect(x["Equities:AAPL"]).toEqual({ sector: "Information Technology", country: "US" });
  });
  it("calls an ETF Diversified, with no country", () => {
    const x = marketExtras([row({ ticker: "VOO" })], { VOO: profile({ isEtf: true, sector: "Asset Management" }) });
    expect(x["Equities:VOO"]).toEqual({ sector: "Diversified" });
  });
  it("never replaces what the file already had", () => {
    const x = marketExtras([row({ ticker: "AAPL", sector: "Financials", country: "CA" })], { AAPL: profile({ sector: "Technology", country: "US" }) });
    expect(x).toEqual({});
  });
  it("fills only the country when the file had the sector", () => {
    const x = marketExtras([row({ ticker: "AAPL", sector: "Financials" })], { AAPL: profile({ sector: "Technology", country: "US" }) });
    expect(x["Equities:AAPL"]).toEqual({ country: "US" });
  });
  it("gives no country to a fund the file already called Diversified", () => {
    const x = marketExtras([row({ ticker: "VOO", sector: "Diversified" })], { VOO: profile({ isEtf: false, country: "US" }) });
    expect(x).toEqual({});
  });
  it("adds nothing for a sector name it can't translate, or a ticker with no answer", () => {
    const x = marketExtras([row({ ticker: "AAA" }), row({ ticker: "ZZZ" }), row({ ticker: "NUL" })], { AAA: profile({ sector: "Weird Sector" }), NUL: null });
    expect(x).toEqual({});
  });
  it("ignores bonds and alternatives", () => {
    const x = marketExtras([row({ ticker: "BND", assetClass: "Fixed Income" })], { BND: profile({ isEtf: true }) });
    expect(x).toEqual({});
  });
});

describe("sectorsForClaude", () => {
  it("lists equity rows that still have no sector, once each", () => {
    const rows = [row({ ticker: "AAA" }), row({ ticker: "aaa" }), row({ ticker: "BBB" }), row({ ticker: "CCC", sector: "Energy" }), row({ ticker: "GLD", assetClass: "Alternatives" })];
    const got = sectorsForClaude(rows, { "Equities:BBB": { sector: "Financials" } });
    expect(got.map((g) => g.ticker)).toEqual(["AAA"]);
  });
});

describe("checkSector / addClaudeSectors", () => {
  it("keeps the app's sectors and Diversified, drops anything else", () => {
    expect(checkSector("Health Care")).toBe("Health Care");
    expect(checkSector("Diversified")).toBe("Diversified");
    expect(checkSector("Weird Sector")).toBeNull();
    expect(checkSector("")).toBeNull();
  });
  it("translates other spellings and ignores capital letters, as for market data", () => {
    expect(checkSector("Technology")).toBe("Information Technology");
    expect(checkSector("  healthcare ")).toBe("Health Care");
    expect(checkSector("Financial Services")).toBe("Financials");
    expect(checkSector("information technology")).toBe("Information Technology");
    expect(checkSector("DIVERSIFIED")).toBe("Diversified");
  });
  it("adds Claude's sector only where there is none", () => {
    const rows = [row({ ticker: "AAA" }), row({ ticker: "BBB" }), row({ ticker: "CCC", sector: "Energy" })];
    const out = addClaudeSectors(rows, { "Equities:BBB": { sector: "Financials" } }, { AAA: "Utilities", BBB: "Materials", CCC: "Utilities" });
    expect(out["Equities:AAA"].sector).toBe("Utilities");
    expect(out["Equities:BBB"].sector).toBe("Financials");
    expect(out["Equities:CCC"]).toBeUndefined();
  });
});

describe("withExtras / stillBlank", () => {
  it("fills blanks and keeps file values", () => {
    const h = withExtras(row({ ticker: "AAPL", country: "CA" }), { sector: "Energy", country: "US" });
    expect(h.sector).toBe("Energy");
    expect(h.country).toBe("CA");
    expect(withExtras(row({ ticker: "BND", assetClass: "Fixed Income" }), { subtype: "Medium-term" }).subtype).toBe("Medium-term");
    expect(withExtras(row({ ticker: "X", sector: "Financials" }), { sector: "Energy" }).sector).toBe("Financials");
  });
  it("counts rows with nothing yet for what applies to them", () => {
    const rows = [row({ ticker: "A" }), row({ ticker: "B" }), row({ ticker: "BND", assetClass: "Fixed Income" }), row({ ticker: "GLD", assetClass: "Alternatives", subtype: "Commodities" })];
    expect(stillBlank(rows, { "Equities:B": { sector: "Energy" } })).toBe(2); // A and BND
  });
});
