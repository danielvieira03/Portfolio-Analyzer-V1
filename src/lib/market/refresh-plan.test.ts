import { describe, expect, it } from "vitest";
import { checkEveryMs, isStale, planPriceUpdates } from "./refresh-plan";

const holdings = [
  { id: "a", ticker: "AAPL", assetClass: "Equities" },
  { id: "b", ticker: "BND", assetClass: "Fixed Income" },
  { id: "c", ticker: "ZZZZ", assetClass: "Equities" },
];
const profile = (price: number) => ({ name: "n", price, sector: null, isEtf: false, country: null });

describe("planPriceUpdates", () => {
  it("sets prices that were found and flags the rest as manual", () => {
    const plan = planPriceUpdates(holdings, new Map([["AAPL", profile(300)], ["BND", profile(70)], ["ZZZZ", null]]));
    expect(plan.found).toEqual([{ id: "a", price: 300 }, { id: "b", price: 70 }]);
    expect(plan.missing).toEqual(["c"]);
  });
  it("leaves a ticker alone when the API never answered for it (limit or network trouble)", () => {
    const plan = planPriceUpdates(holdings, new Map([["AAPL", profile(300)]]));
    expect(plan.found).toEqual([{ id: "a", price: 300 }]);
    expect(plan.missing).toEqual([]);
  });
});

describe("isStale", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  it("is stale when never updated", () => expect(isStale(null, now, 60)).toBe(true));
  it("is fresh inside the interval", () => expect(isStale(new Date("2026-10-18T11:30:00Z"), now, 60)).toBe(false));
  it("is stale at or past the interval", () => {
    expect(isStale(new Date("2026-10-18T11:00:00Z"), now, 60)).toBe(true);
    expect(isStale(new Date("2026-10-18T09:00:00Z"), now, 60)).toBe(true);
  });
});

describe("checkEveryMs", () => {
  it("checks every 30 seconds for a 2-minute interval", () => expect(checkEveryMs(2)).toBe(30_000));
  it("checks at most once a minute for long intervals", () => {
    expect(checkEveryMs(60)).toBe(60_000);
    expect(checkEveryMs(4)).toBe(60_000);
  });
  it("never checks more often than every 15 seconds", () => expect(checkEveryMs(0.5)).toBe(15_000));
});

describe("planPriceUpdates country", () => {
  const stock = { name: "n", price: 5, sector: null, isEtf: false, country: "NL" };
  it("carries a stock's country, but only for Equities", () => {
    const plan = planPriceUpdates(
      [{ id: "a", ticker: "ASML", assetClass: "Equities" }, { id: "b", ticker: "BND", assetClass: "Fixed Income" }],
      new Map([["ASML", stock], ["BND", stock]]),
    );
    expect(plan.found).toEqual([{ id: "a", price: 5, country: "NL" }, { id: "b", price: 5 }]);
  });
  it("omits the country when the provider gave none", () => {
    const plan = planPriceUpdates([{ id: "a", ticker: "X", assetClass: "Equities" }], new Map([["X", { ...stock, country: null }]]));
    expect(plan.found).toEqual([{ id: "a", price: 5 }]);
  });
});
