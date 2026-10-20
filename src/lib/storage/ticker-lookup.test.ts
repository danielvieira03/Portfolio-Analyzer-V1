import { describe, expect, it, vi } from "vitest";
import type { FundRecord } from "@/lib/funds/library";
import { fundAssetClass, type MarketProfile } from "@/lib/market/profile";
import { lookupTicker } from "./ticker-lookup";

const stock: MarketProfile = { name: "Apple Inc.", price: 300, sector: "Technology", isEtf: false, country: null };
const etf: MarketProfile = { name: "Vanguard S&P 500 ETF", price: 700, sector: "Financial Services", isEtf: true, country: null };
const lib: FundRecord[] = [
  { ticker: "BND", name: "Vanguard Total Bond", assetClass: "Fixed Income", subtype: "Medium-term", durationYears: 5.7 },
  { ticker: "GLD", name: "SPDR Gold", assetClass: "Alternatives", subtype: "Commodities", durationYears: null },
];
const deps = (profile: MarketProfile | null) => ({
  fetchProfile: vi.fn(async () => profile),
  libraryFunds: (tickers: string[]) => lib.filter((f) => tickers.includes(f.ticker)),
});

describe("lookupTicker", () => {
  it("fills name, price and the stock's sector in the Equities form", async () => {
    expect(await lookupTicker("aapl", "Equities", deps(stock))).toEqual({ found: true, name: "Apple Inc.", price: 300, sector: "Information Technology" });
  });
  it("files an ETF under Diversified", async () => {
    expect((await lookupTicker("VOO", "Equities", deps(etf))).sector).toBe("Diversified");
  });
  it("gives no sector in the bond and alternatives forms", async () => {
    const r = await lookupTicker("BND", "Fixed Income", deps({ ...etf, name: "Vanguard Total Bond Market ETF", price: 70 }));
    expect(r.sector).toBeUndefined();
  });
  it("adds the maturity / type from the visitor's own fund library", async () => {
    expect((await lookupTicker("BND", "Fixed Income", deps(null))).subtype).toBe("Medium-term");
    expect((await lookupTicker("GLD", "Alternatives", deps(null))).subtype).toBe("Commodities");
  });
  it("still finds a library fund when market data has nothing", async () => {
    expect(await lookupTicker("BND", "Fixed Income", deps(null))).toEqual({ found: true, subtype: "Medium-term" });
  });
  it("refuses a library fund typed under another asset class, filling nothing", async () => {
    const r = await lookupTicker("GLD", "Fixed Income", deps(null));
    expect(r).toEqual({ found: false, wrongClass: { assetClass: "Alternatives", message: "GLD is an alternatives fund, so it belongs under Alternatives." } });
    const bondInEquities = await lookupTicker("BND", "Equities", deps({ ...etf, name: "Vanguard Total Bond Market ETF", price: 70 }));
    expect(bondInEquities.found).toBe(false);
    expect(bondInEquities.wrongClass?.assetClass).toBe("Fixed Income");
    expect(bondInEquities.name).toBeUndefined();
  });
  it("finds nothing for an unknown ticker or text that is not a ticker, without calling the server for the latter", async () => {
    const d = deps(null);
    expect(await lookupTicker("ZZZZ", "Equities", d)).toEqual({ found: false });
    const d2 = deps(stock);
    expect(await lookupTicker("not a ticker!", "Equities", d2)).toEqual({ found: false });
    expect(d2.fetchProfile).not.toHaveBeenCalled();
  });
});

describe("lookupTicker country", () => {
  const dutch: MarketProfile = { name: "ASML", price: 800, sector: "Technology", isEtf: false, country: "NL" };
  it("gives a stock's country in the Equities form only", async () => {
    expect((await lookupTicker("ASML", "Equities", deps(dutch))).country).toBe("NL");
    expect((await lookupTicker("ASML", "Fixed Income", deps(dutch))).country).toBeUndefined();
  });
  it("gives no country for an ETF or when the provider has none", async () => {
    expect((await lookupTicker("VOO", "Equities", deps(etf))).country).toBeUndefined();
    expect((await lookupTicker("AAPL", "Equities", deps(stock))).country).toBeUndefined();
  });
});

describe("lookupTicker: keeping asset classes apart", () => {
  it("refuses a stock typed under Fixed Income or Alternatives, filling nothing", async () => {
    for (const cls of ["Fixed Income", "Alternatives"]) {
      const r = await lookupTicker("AAPL", cls, deps(stock));
      expect(r).toEqual({ found: false, wrongClass: { assetClass: "Equities", message: "AAPL is a stock, so it belongs under Equities." } });
    }
  });
  it("uses the fund's category when the library doesn't know it", async () => {
    const bond = { ...etf, name: "Some Bond ETF", category: "Core Investment Grade Bond" };
    expect((await lookupTicker("XBND", "Equities", deps(bond))).wrongClass?.message).toBe("XBND is a bond fund, so it belongs under Fixed Income.");
    expect((await lookupTicker("XBND", "Fixed Income", deps(bond))).found).toBe(true);
    const equityEtf = { ...etf, category: "Large Cap Equity" };
    expect((await lookupTicker("XEQ", "Alternatives", deps(equityEtf))).wrongClass?.message).toBe("XEQ is an equity fund, so it belongs under Equities.");
    expect((await lookupTicker("XEQ", "Equities", deps(equityEtf))).sector).toBe("Diversified");
  });
  it("never refuses a fund whose category is unclear or missing", async () => {
    for (const category of [undefined, null, "Allocation--50% to 70% Equity Mix", "Miscellaneous"]) {
      expect((await lookupTicker("XYZ", "Fixed Income", deps({ ...etf, category }))).found).toBe(true);
    }
  });
});

describe("fundAssetClass", () => {
  it("reads the provider's fund categories", () => {
    expect(fundAssetClass("Large Cap Equity")).toBe("Equities");
    expect(fundAssetClass("Core Investment Grade Bond")).toBe("Fixed Income");
    expect(fundAssetClass("Treasury Inflation-Protected")).toBe("Fixed Income");
    expect(fundAssetClass("Commodities")).toBe("Alternatives");
    expect(fundAssetClass("Real Estate (Listed/REITs)")).toBe("Alternatives");
    expect(fundAssetClass("Alternatives")).toBe("Alternatives");
    expect(fundAssetClass("Equity Income Bond Hybrid")).toBeNull(); // mixed funds are unclear
    expect(fundAssetClass("Allocation--50% to 70% Equity Mix")).toBeNull();
    expect(fundAssetClass("")).toBeNull();
    expect(fundAssetClass(null)).toBeNull();
    expect(fundAssetClass("Miscellaneous")).toBeNull();
  });
});
