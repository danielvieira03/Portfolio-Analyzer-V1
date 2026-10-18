import { describe, expect, it, vi } from "vitest";
import type { FundRecord } from "@/lib/funds/library";
import type { MarketProfile } from "@/lib/market/profile";
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
  it("ignores a library fund of another asset class", async () => {
    expect(await lookupTicker("GLD", "Fixed Income", deps(null))).toEqual({ found: false });
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
