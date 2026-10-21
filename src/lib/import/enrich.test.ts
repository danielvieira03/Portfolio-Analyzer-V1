import { describe, expect, it } from "vitest";
import type { HoldingInput } from "@/lib/holdings/schema";
import type { MarketProfile } from "@/lib/market/profile";
import { addClaudeSectors, checkSector, marketExtras, marketLookupTickers, sectorsForClaude, stillBlank, withExtras } from "./enrich";

const row = (o: Partial<HoldingInput> & { ticker: string }): HoldingInput => ({
  name: o.ticker, assetClass: "Equities", sector: null, subtype: null, country: null, dividend: null, shares: 1, costBasisPerShare: 1, currentPrice: 1, ...o,
});
const profile = (o: Partial<MarketProfile>): MarketProfile => ({ name: "X", price: 10, sector: null, isEtf: false, country: null, ...o });

describe("marketLookupTickers", () => {
  it("asks about every row, once each, upper-case (the latest price is wanted for all of them)", () => {
    const rows = [
      row({ ticker: "aapl" }),
      row({ ticker: "AAPL" }),
      row({ ticker: "MSFT", sector: "Information Technology", country: "US" }), // complete, but its price is still wanted
      row({ ticker: "BND", assetClass: "Fixed Income" }),
    ];
    expect(marketLookupTickers(rows)).toEqual(["AAPL", "MSFT", "BND"]);
  });
});

describe("marketExtras", () => {
  it("gives a stock its translated sector and country, and its latest price", () => {
    const x = marketExtras([row({ ticker: "AAPL" })], { AAPL: profile({ sector: "Technology", country: "US", price: 212.5 }) });
    expect(x["Equities:AAPL"]).toEqual({ price: 212.5, sector: "Information Technology", country: "US" });
  });
  it("calls an ETF Diversified, with no country", () => {
    const x = marketExtras([row({ ticker: "VOO" })], { VOO: profile({ isEtf: true, sector: "Asset Management" }) });
    expect(x["Equities:VOO"]).toEqual({ price: 10, sector: "Diversified" });
  });
  it("never replaces a sector or country the file already had, but still brings the latest price", () => {
    const x = marketExtras([row({ ticker: "AAPL", sector: "Financials", country: "CA" })], { AAPL: profile({ sector: "Technology", country: "US", price: 200 }) });
    expect(x["Equities:AAPL"]).toEqual({ price: 200 });
  });
  it("fills only the country (and price) when the file had the sector", () => {
    const x = marketExtras([row({ ticker: "AAPL", sector: "Financials" })], { AAPL: profile({ sector: "Technology", country: "US" }) });
    expect(x["Equities:AAPL"]).toEqual({ price: 10, country: "US" });
  });
  it("gives no country to a fund the file already called Diversified", () => {
    const x = marketExtras([row({ ticker: "VOO", sector: "Diversified" })], { VOO: profile({ isEtf: false, country: "US" }) });
    expect(x["Equities:VOO"]).toEqual({ price: 10 });
  });
  it("adds only the price for a sector name it can't translate, and nothing for a ticker with no answer", () => {
    const x = marketExtras([row({ ticker: "AAA" }), row({ ticker: "ZZZ" }), row({ ticker: "NUL" })], { AAA: profile({ sector: "Weird Sector" }), NUL: null });
    expect(x).toEqual({ "Equities:AAA": { price: 10 } });
  });
  it("brings the latest price for bonds and alternatives too, and nothing else", () => {
    const x = marketExtras(
      [row({ ticker: "BND", assetClass: "Fixed Income" }), row({ ticker: "GLD", assetClass: "Alternatives" })],
      { BND: profile({ isEtf: true, price: 72.1 }), GLD: profile({ price: 280 }) },
    );
    expect(x).toEqual({ "Fixed Income:BND": { price: 72.1 }, "Alternatives:GLD": { price: 280 } });
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
  it("the latest price replaces the file's price; without one the file's price stays", () => {
    expect(withExtras(row({ ticker: "A", currentPrice: 100 }), { price: 123.45 }).currentPrice).toBe(123.45);
    expect(withExtras(row({ ticker: "A", currentPrice: 100 }), { sector: "Energy" }).currentPrice).toBe(100);
    expect(withExtras(row({ ticker: "A", currentPrice: 100 }), undefined).currentPrice).toBe(100);
  });
  it("counts rows with nothing yet for what applies to them", () => {
    const rows = [row({ ticker: "A" }), row({ ticker: "B" }), row({ ticker: "BND", assetClass: "Fixed Income" }), row({ ticker: "GLD", assetClass: "Alternatives", subtype: "Commodities" })];
    expect(stillBlank(rows, { "Equities:B": { sector: "Energy" } })).toBe(2); // A and BND
  });
});
