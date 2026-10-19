import { describe, expect, it, vi } from "vitest";
import { addHolding, type PortfolioDoc } from "@/lib/portfolio/ledger";
import { createPortfolioStore, type StorageLike } from "./portfolio-store";
import { onceAtATime, runPriceRefresh, type PriceFetchResult } from "./price-refresh";

const memory = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const profile = (price: number) => ({ name: "n", price, sector: null, isEtf: false, country: null });
const now = new Date("2026-10-18T12:00:00Z");

function setup(opts: { updatedAt?: string | null } = {}) {
  const store = createPortfolioStore(memory());
  store.update((d: PortfolioDoc) => ({ ...d, pricesUpdatedAt: opts.updatedAt ?? null }));
  return store;
}
const tickersOf = (store: ReturnType<typeof setup>) => store.getSnapshot().doc.holdings.map((h) => h.ticker);
const answer = (store: ReturnType<typeof setup>, price = 100, status: PriceFetchResult["status"] = "ok"): PriceFetchResult => ({
  status,
  profiles: Object.fromEntries(tickersOf(store).map((t) => [t, profile(price)])),
});

describe("runPriceRefresh", () => {
  it("fetches the tickers of THIS visitor's portfolio and saves the prices and the time", async () => {
    const store = setup();
    const fetchPrices = vi.fn(async () => answer(store, 111));
    const r = await runPriceRefresh(false, { store, fetchPrices, now: () => now, minutes: 60 });
    expect(fetchPrices).toHaveBeenCalledWith(tickersOf(store));
    expect(r.status).toBe("updated");
    const doc = store.getSnapshot().doc;
    expect(doc.holdings.every((h) => h.currentPrice === 111)).toBe(true);
    expect(doc.pricesUpdatedAt).toBe(now.toISOString());
    expect(doc.isDemoData).toBe(true); // refreshing prices is not an edit
  });

  it("does nothing when prices are fresh (unless forced)", async () => {
    const store = setup({ updatedAt: "2026-10-18T11:30:00.000Z" });
    const fetchPrices = vi.fn(async () => answer(store));
    expect((await runPriceRefresh(false, { store, fetchPrices, now: () => now, minutes: 60 })).status).toBe("fresh");
    expect(fetchPrices).not.toHaveBeenCalled();
    expect((await runPriceRefresh(true, { store, fetchPrices, now: () => now })).status).toBe("updated");
    expect(fetchPrices).toHaveBeenCalledOnce();
  });

  it("refreshes when the last refresh is an hour old", async () => {
    const store = setup({ updatedAt: "2026-10-18T11:00:00.000Z" });
    const fetchPrices = vi.fn(async () => answer(store));
    expect((await runPriceRefresh(false, { store, fetchPrices, now: () => now, minutes: 60 })).status).toBe("updated");
  });

  it("does not call the server when there is nothing to refresh", async () => {
    const store = setup();
    store.update((d) => ({ ...d, holdings: [] }));
    const fetchPrices = vi.fn();
    expect((await runPriceRefresh(true, { store, fetchPrices, now: () => now })).status).toBe("fresh");
    expect(fetchPrices).not.toHaveBeenCalled();
  });

  it("keeps the manual price and flags a ticker with no price", async () => {
    const store = setup();
    const [first] = tickersOf(store);
    const before = store.getSnapshot().doc.holdings[0].currentPrice;
    const res = answer(store, 50);
    res.profiles[first] = null;
    const r = await runPriceRefresh(true, { store, fetchPrices: async () => res, now: () => now });
    expect(r.unavailable).toBe(1);
    expect(store.getSnapshot().doc.holdings[0]).toMatchObject({ currentPrice: before, noLivePrice: true });
  });

  it("on a usage limit it keeps old prices and says so (nothing answered)", async () => {
    const store = setup();
    const before = JSON.stringify(store.getSnapshot().doc.holdings);
    const r = await runPriceRefresh(true, { store, fetchPrices: async () => ({ status: "limit", profiles: {} }), now: () => now });
    expect(r).toEqual({ status: "limit", updated: 0, unavailable: 0, breakdown: "none" });
    expect(JSON.stringify(store.getSnapshot().doc.holdings)).toBe(before);
    expect(store.getSnapshot().doc.pricesUpdatedAt).toBeNull();
  });

  it("reports a missing key or an unreachable service without changing anything", async () => {
    const store = setup();
    for (const status of ["no_key", "unreachable"] as const) {
      const r = await runPriceRefresh(true, { store, fetchPrices: async () => ({ status, profiles: {} }), now: () => now });
      expect(r.status).toBe(status);
    }
    expect(store.getSnapshot().doc.pricesUpdatedAt).toBeNull();
  });

  it("applies answers to the portfolio as it is now (a holding removed while waiting is skipped)", async () => {
    const store = setup();
    const removedId = store.getSnapshot().doc.holdings[0].id;
    const fetchPrices = async () => {
      store.update((d) => ({ ...d, holdings: d.holdings.filter((h) => h.id !== removedId) }));
      return answer(setup(), 77);
    };
    const r = await runPriceRefresh(true, { store, fetchPrices, now: () => now });
    expect(r.status).toBe("updated");
    expect(store.getSnapshot().doc.holdings.some((h) => h.id === removedId)).toBe(false);
  });

  it("keeps two visitors apart: one visitor's refresh does not touch the other's portfolio", async () => {
    const a = setup();
    const b = setup();
    b.update((d) => addHolding(d, { ticker: "BOB", name: "Bob Co", assetClass: "Equities", sector: "Energy", subtype: null, country: null, shares: 1, costBasisPerShare: 1, currentPrice: 5 }).doc);
    const bBefore = JSON.stringify(b.getSnapshot().doc);
    await runPriceRefresh(true, { store: a, fetchPrices: async () => answer(a, 999), now: () => now });
    expect(JSON.stringify(b.getSnapshot().doc)).toBe(bBefore);
  });
});

describe("onceAtATime", () => {
  it("shares one run between simultaneous callers, then allows a new one", async () => {
    let calls = 0;
    const slow = onceAtATime(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    });
    const [x, y] = await Promise.all([slow(), slow()]);
    expect(x).toBe(1);
    expect(y).toBe(1);
    expect(await slow()).toBe(2);
  });
});

describe("runPriceRefresh: fund breakdowns", () => {
  const bd = (updatedAt = now.toISOString()) => ({ sectors: [{ name: "Energy", weight: 1 }], countries: [{ code: "US", weight: 1 }], updatedAt, status: "ok" as const });
  const funds = (store: ReturnType<typeof setup>) =>
    store.getSnapshot().doc.holdings.filter((h) => h.assetClass === "Fixed Income" || h.sector === "Diversified").map((h) => h.ticker);

  it("looks up only the funds that are due (once per week) and saves the answers", async () => {
    const store = setup();
    const fetchBreakdowns = vi.fn(async (f: { ticker: string; sectors: boolean }[]) => ({ status: "ok" as const, breakdowns: Object.fromEntries(f.map((x) => [x.ticker, bd()])) }));
    const r = await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), fetchBreakdowns, now: () => now });
    expect(r.breakdown).toBe("updated");
    expect((fetchBreakdowns.mock.calls[0][0]).map((f) => f.ticker)).toEqual(funds(store).map((t) => t.toUpperCase()));
    const byTicker = Object.fromEntries(fetchBreakdowns.mock.calls[0][0].map((f) => [f.ticker, f.sectors]));
    expect(byTicker.VOO).toBe(true); // equity ETF: sectors and countries
    expect(byTicker.BND).toBe(false); // bond fund: countries only
    expect(Object.keys(store.getSnapshot().doc.etfBreakdowns).sort()).toEqual(funds(store).map((t) => t.toUpperCase()).sort());
    expect(store.getSnapshot().doc.isDemoData).toBe(true);

    fetchBreakdowns.mockClear();
    const again = await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), fetchBreakdowns, now: () => now });
    expect(again.breakdown).toBe("none");
    expect(fetchBreakdowns).not.toHaveBeenCalled(); // saved today: not due for a week
  });

  it("looks them up again after a week", async () => {
    const store = setup();
    store.update((d) => ({ ...d, etfBreakdowns: Object.fromEntries(funds(store).map((t) => [t.toUpperCase(), bd("2026-10-01T00:00:00.000Z")])) }));
    const fetchBreakdowns = vi.fn(async () => ({ status: "ok" as const, breakdowns: {} }));
    await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), fetchBreakdowns, now: () => now });
    expect(fetchBreakdowns).toHaveBeenCalledOnce();
  });

  for (const status of ["limit", "restricted", "unreachable"] as const) {
    it(`on '${status}' keeps the saved data and reports it quietly (prices still saved)`, async () => {
      const store = setup();
      const old = Object.fromEntries(funds(store).map((t) => [t.toUpperCase(), bd("2026-10-01T00:00:00.000Z")]));
      store.update((d) => ({ ...d, etfBreakdowns: old }));
      const r = await runPriceRefresh(true, { store, fetchPrices: async () => answer(store, 77), fetchBreakdowns: async () => ({ status, breakdowns: {} }), now: () => now });
      expect(r).toMatchObject({ status: "updated", breakdown: status });
      expect(store.getSnapshot().doc.etfBreakdowns).toEqual(old);
      expect(store.getSnapshot().doc.holdings.every((h) => h.currentPrice === 77)).toBe(true);
    });
  }

  it("a thrown error in the lookup is treated as unreachable, not a failed refresh", async () => {
    const store = setup();
    const r = await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), fetchBreakdowns: async () => { throw new Error("boom"); }, now: () => now });
    expect(r).toMatchObject({ status: "updated", breakdown: "unreachable" });
  });

  it("after a problem, the very next refresh (automatic or manual) tries again, with no pause", async () => {
    const store = setup();
    const fetchBreakdowns = vi.fn(async () => ({ status: "limit" as const, breakdowns: {} }));
    const deps = { store, fetchPrices: async () => answer(store), fetchBreakdowns, now: () => now, minutes: 0 };
    await runPriceRefresh(false, deps);
    await runPriceRefresh(false, deps);
    await runPriceRefresh(true, deps);
    expect(fetchBreakdowns).toHaveBeenCalledTimes(3);
  });

  it("does not look up funds when the price lookup itself failed, or when no lookup is given", async () => {
    const store = setup();
    const fetchBreakdowns = vi.fn();
    const r = await runPriceRefresh(true, { store, fetchPrices: async () => answer(store, 100, "limit"), fetchBreakdowns, now: () => now });
    expect(r.breakdown).toBe("none");
    expect(fetchBreakdowns).not.toHaveBeenCalled();
    expect((await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), now: () => now })).breakdown).toBe("none");
  });

  it("looks up at most 50 funds at a time", async () => {
    const store = setup();
    store.update((d) => ({
      ...d,
      holdings: Array.from({ length: 70 }, (_, i) => ({ ...d.holdings[0], id: `x${i}`, ticker: `ETF${i}`, assetClass: "Equities" as const, sector: "Diversified" })),
    }));
    const fetchBreakdowns = vi.fn(async () => ({ status: "ok" as const, breakdowns: {} }));
    await runPriceRefresh(true, { store, fetchPrices: async () => answer(store), fetchBreakdowns, now: () => now });
    expect((fetchBreakdowns.mock.calls[0] as unknown as [unknown[]])[0]).toHaveLength(50);
  });

});
