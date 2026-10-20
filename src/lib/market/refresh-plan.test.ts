import { describe, expect, it } from "vitest";
import { breakdownsDue, checkEveryMs, isStale, planPriceUpdates } from "./refresh-plan";

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

describe("breakdownsDue", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const h = (ticker: string, assetClass: string, sector: string | null = null) => ({ ticker, assetClass: assetClass as "Equities", sector });
  const saved = (updatedAt: string, status: "ok" | "none" = "ok", mapping?: number) => ({ sectors: [], countries: [], updatedAt, status, mapping });
  const mine = [h("AAPL", "Equities", "Information Technology"), h("VOO", "Equities", "Diversified"), h("BND", "Fixed Income"), h("GLD", "Alternatives")];

  it("asks for equity ETFs and bond funds with nothing saved, not for stocks or alternatives", () => {
    expect(breakdownsDue(mine, {}, now, 7, 1)).toEqual([{ ticker: "VOO", sectors: true }, { ticker: "BND", sectors: false }]);
  });
  it("leaves funds alone until their data is a week old", () => {
    const fresh = { VOO: saved("2026-10-12T12:00:01.000Z"), BND: saved("2026-10-18T00:00:00.000Z") };
    expect(breakdownsDue(mine, fresh, now, 7, 1)).toEqual([]);
    const old = { VOO: saved("2026-10-11T12:00:00.000Z"), BND: saved("2026-10-18T00:00:00.000Z") };
    expect(breakdownsDue(mine, old, now, 7, 1)).toEqual([{ ticker: "VOO", sectors: true }]);
  });
  it("looks a fund up again when its saved data was made with an older name translation, even if fresh", () => {
    const fresh = "2026-10-18T00:00:00.000Z";
    const saved2 = { VOO: saved(fresh, "ok", 1), BND: saved(fresh, "ok", 2) };
    expect(breakdownsDue(mine, saved2, now, 7, 2)).toEqual([{ ticker: "VOO", sectors: true }]);
    expect(breakdownsDue(mine, { VOO: saved(fresh), BND: saved(fresh, "ok", 2) }, now, 7, 2)).toEqual([{ ticker: "VOO", sectors: true }]); // none = version 1
    expect(breakdownsDue(mine, { VOO: saved(fresh, "ok", 2), BND: saved(fresh, "ok", 3) }, now, 7, 2)).toEqual([]);
  });
  it("retries a 'no data' answer only after the same week", () => {
    expect(breakdownsDue(mine, { VOO: saved("2026-10-17T00:00:00.000Z", "none"), BND: saved("2026-10-17T00:00:00.000Z", "none") }, now, 7, 1)).toEqual([]);
  });
  it("a ticker held as both an equity ETF and a bond fund still gets its sectors", () => {
    for (const list of [[h("X", "Fixed Income"), h("X", "Equities", "Diversified")], [h("X", "Equities", "Diversified"), h("X", "Fixed Income")]]) {
      expect(breakdownsDue(list, {}, now, 7, 1)).toEqual([{ ticker: "X", sectors: true }]);
    }
  });
  it("lists a ticker once and in upper case, and treats a damaged date as due", () => {
    expect(breakdownsDue([h("voo", "Equities", "Diversified"), h("VOO", "Equities", "Diversified")], {}, now, 7, 1)).toEqual([{ ticker: "VOO", sectors: true }]);
    expect(breakdownsDue([h("VOO", "Equities", "Diversified")], { VOO: saved("not a date") }, now, 7, 1)).toEqual([{ ticker: "VOO", sectors: true }]);
  });
});

describe("planPriceUpdates: filling a blank sector", () => {
  const withSector = (price: number, sector: string | null, isEtf = false) => ({ name: "n", price, sector, isEtf, country: null });
  const eq = (id: string, ticker: string, sector: string | null, assetClass = "Equities") => ({ id, ticker, assetClass, sector });
  it("gives a stock with no sector its translated sector", () => {
    const plan = planPriceUpdates([eq("a", "AAPL", null)], new Map([["AAPL", withSector(300, "Technology")]]));
    expect(plan.found).toEqual([{ id: "a", price: 300, sector: "Information Technology" }]);
  });
  it("files an ETF with no sector under Diversified", () => {
    const plan = planPriceUpdates([eq("a", "VOO", null)], new Map([["VOO", withSector(700, "Financial Services", true)]]));
    expect(plan.found[0].sector).toBe("Diversified");
  });
  it("never offers a replacement for a sector that is already set", () => {
    const plan = planPriceUpdates([eq("a", "AAPL", "Energy")], new Map([["AAPL", withSector(300, "Technology")]]));
    expect(plan.found[0].sector).toBeUndefined();
  });
  it("leaves bonds and alternatives alone, and a sector name it can't translate stays blank", () => {
    const plan = planPriceUpdates(
      [eq("b", "BND", null, "Fixed Income"), eq("g", "GLD", null, "Alternatives"), eq("w", "WEIRD", null)],
      new Map([["BND", withSector(70, "Financial Services", true)], ["GLD", withSector(300, null, true)], ["WEIRD", withSector(10, "Strange Sector")]]),
    );
    expect(plan.found.map((f) => f.sector)).toEqual([undefined, undefined, undefined]);
  });
});
