import { describe, expect, it, vi } from "vitest";
import { DEMO_HOLDINGS } from "@/config/demo-portfolio";
import { addHolding, newVisitorDoc, removeHolding } from "@/lib/portfolio/ledger";
import { CORRUPT_KEY, STORAGE_KEY, createPortfolioStore, type StorageLike } from "./portfolio-store";

/** A fake browser storage. Each "browser" gets its own, like real visitors. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
const holding = { ticker: "ZZZ", name: "Z Co", assetClass: "Equities" as const, sector: "Energy", subtype: null, shares: 1, costBasisPerShare: 1, currentPrice: 2 };

describe("createPortfolioStore", () => {
  it("gives a first-time visitor the demo portfolio and saves it", () => {
    const s = fakeStorage();
    const store = createPortfolioStore(s);
    expect(store.getSnapshot().doc.holdings).toHaveLength(DEMO_HOLDINGS.length);
    expect(store.getSnapshot().doc.isDemoData).toBe(true);
    expect(store.getSnapshot().status).toBe("ok");
    expect(s.data.has(STORAGE_KEY)).toBe(true);
  });

  it("saves every change and a new visit sees it", () => {
    const s = fakeStorage();
    const a = createPortfolioStore(s);
    a.update((d) => addHolding(d, holding).doc);
    const b = createPortfolioStore(s); // same browser, later visit
    expect(b.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(true);
    expect(b.getSnapshot().doc.isDemoData).toBe(false);
  });

  it("keeps two visitors completely separate", () => {
    const alice = createPortfolioStore(fakeStorage());
    const bob = createPortfolioStore(fakeStorage());
    alice.update((d) => addHolding(d, holding).doc);
    alice.update((d) => removeHolding(d, d.holdings[0].id));
    expect(alice.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(true);
    expect(bob.getSnapshot().doc.holdings).toHaveLength(DEMO_HOLDINGS.length);
    expect(bob.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(false);
    expect(bob.getSnapshot().doc.isDemoData).toBe(true);
  });

  it("notifies listeners on a change, but not when nothing changed", () => {
    const store = createPortfolioStore(fakeStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.update((d) => d); // no change
    expect(listener).not.toHaveBeenCalled();
    store.update((d) => addHolding(d, holding).doc);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.update((d) => addHolding(d, { ...holding, ticker: "YYY" }).doc);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the same snapshot object until something changes", () => {
    const store = createPortfolioStore(fakeStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("recovers from damaged saved data: starts fresh, keeps a copy, says so once", () => {
    const s = fakeStorage({ [STORAGE_KEY]: "{this is damaged" });
    const store = createPortfolioStore(s);
    expect(store.getSnapshot().status).toBe("recovered");
    expect(store.getSnapshot().doc.holdings).toHaveLength(DEMO_HOLDINGS.length);
    expect(s.data.get(CORRUPT_KEY)).toBe("{this is damaged");
    store.dismissNotice();
    expect(store.getSnapshot().status).toBe("ok");
  });

  it("works in memory when the browser blocks storage", () => {
    const blocked: StorageLike = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };
    const store = createPortfolioStore(blocked);
    expect(store.getSnapshot().status).toBe("memory-only");
    store.update((d) => addHolding(d, holding).doc);
    expect(store.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(true);
    expect(store.getSnapshot().status).toBe("memory-only");
  });

  it("works with no storage object at all", () => {
    const store = createPortfolioStore(null);
    expect(store.getSnapshot().status).toBe("memory-only");
    expect(store.getSnapshot().doc.holdings.length).toBeGreaterThan(0);
  });

  it("switches to memory-only if saving fails later (e.g. storage full)", () => {
    const s = fakeStorage();
    const store = createPortfolioStore(s);
    s.setItem = () => { throw new Error("quota"); };
    store.update((d) => addHolding(d, holding).doc);
    expect(store.getSnapshot().status).toBe("memory-only");
    expect(store.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(true);
  });

  it("replace() swaps in a restored portfolio and saves it", () => {
    const s = fakeStorage();
    const store = createPortfolioStore(s);
    const restored = { ...newVisitorDoc(), holdings: [], cash: 5, isDemoData: false };
    store.replace(restored);
    expect(store.getSnapshot().doc.cash).toBe(5);
    expect(createPortfolioStore(s).getSnapshot().doc.cash).toBe(5);
  });

  it("reload() picks up a change made by another tab", () => {
    const s = fakeStorage();
    const tab1 = createPortfolioStore(s);
    const tab2 = createPortfolioStore(s);
    tab2.update((d) => addHolding(d, holding).doc);
    const listener = vi.fn();
    tab1.subscribe(listener);
    tab1.reload();
    expect(tab1.getSnapshot().doc.holdings.some((h) => h.ticker === "ZZZ")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    tab1.reload(); // nothing new
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
