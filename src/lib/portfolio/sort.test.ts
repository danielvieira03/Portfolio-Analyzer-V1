import { describe, expect, it } from "vitest";
import { sortPositions } from "./sort";
import type { Position } from "./types";

const p = (ticker: string, price: number, cost: number, name = ticker): Position => ({
  id: ticker, ticker, name, assetClass: "Equities", sector: null, subtype: null,
  shares: 10, costBasisPerShare: cost, currentPrice: price, priceAsOf: new Date(),
});
const list = [p("MSFT", 400, 300), p("AAPL", 200, 250), p("NVDA", 140, 60)];

describe("sortPositions", () => {
  it("sorts text A-Z and reverses", () => {
    expect(sortPositions(list, "ticker", "asc").map((x) => x.ticker)).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(sortPositions(list, "ticker", "desc").map((x) => x.ticker)).toEqual(["NVDA", "MSFT", "AAPL"]);
  });
  it("sorts by market value", () => {
    expect(sortPositions(list, "marketValue", "desc").map((x) => x.ticker)).toEqual(["MSFT", "AAPL", "NVDA"]);
  });
  it("sorts by gain/loss %, losses last when descending", () => {
    expect(sortPositions(list, "gainLossPct", "desc").map((x) => x.ticker)).toEqual(["NVDA", "MSFT", "AAPL"]);
  });
  it("sorts maturities short to long, with unset last", () => {
    const bond = (ticker: string, subtype: string | null): Position => ({ ...p(ticker, 100, 100), assetClass: "Fixed Income", subtype });
    const bonds = [bond("L", "Long-term"), bond("N", null), bond("S", "Short-term"), bond("M", "Medium-term"), bond("X", "Not specified")];
    expect(sortPositions(bonds, "subtype", "asc").map((x) => x.ticker)).toEqual(["S", "M", "L", "X", "N"]);
  });
  it("does not change the original list", () => {
    sortPositions(list, "ticker", "asc");
    expect(list[0].ticker).toBe("MSFT");
  });
});
