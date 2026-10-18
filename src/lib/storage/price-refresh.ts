// Refreshing every holding's price: the browser decides what to refresh and saves the answers;
// the server only fetches prices for the tickers it is sent. Pure logic with the store and the
// price fetch passed in, so it is tested without a browser or the network.

import { PRICE_REFRESH_MINUTES } from "@/config/market";
import type { FetchStatus } from "@/lib/market/fmp";
import type { MarketProfile } from "@/lib/market/profile";
import { isStale, planPriceUpdates } from "@/lib/market/refresh-plan";
import { applyPrices } from "@/lib/portfolio/ledger";
import type { PortfolioStore } from "./portfolio-store";

export interface PriceFetchResult {
  status: FetchStatus;
  /** Only tickers the provider answered for; null = answered, no usable price. */
  profiles: Record<string, MarketProfile | null>;
}

export interface PriceRefreshResult {
  /** "fresh" = prices were recent enough (or there is nothing to refresh): nothing was fetched. */
  status: "fresh" | "updated" | FetchStatus;
  updated: number;
  /** Holdings the provider had no price for (they keep their manual price). */
  unavailable: number;
}

export interface RefreshDeps {
  store: Pick<PortfolioStore, "getSnapshot" | "update">;
  fetchPrices: (tickers: string[]) => Promise<PriceFetchResult>;
  now?: () => Date;
  minutes?: number;
}

/**
 * Refresh prices. Without `force` it does nothing when the last refresh is newer than the interval,
 * so the automatic check is cheap. The answers are saved into the visitor's own portfolio.
 */
export async function runPriceRefresh(force: boolean, deps: RefreshDeps): Promise<PriceRefreshResult> {
  const now = deps.now ?? (() => new Date());
  const { doc } = deps.store.getSnapshot();
  const last = doc.pricesUpdatedAt ? new Date(doc.pricesUpdatedAt) : null;
  if (!force && !isStale(last, now(), deps.minutes ?? PRICE_REFRESH_MINUTES)) {
    return { status: "fresh", updated: 0, unavailable: 0 };
  }
  const targets = doc.holdings.map((h) => ({ id: h.id, ticker: h.ticker, assetClass: h.assetClass }));
  if (targets.length === 0) return { status: "fresh", updated: 0, unavailable: 0 };

  const result = await deps.fetchPrices(targets.map((t) => t.ticker));
  const plan = planPriceUpdates(targets, new Map(Object.entries(result.profiles)));
  if (plan.found.length > 0 || plan.missing.length > 0) {
    // Apply to the portfolio as it is NOW (the visitor may have edited it while we were waiting).
    deps.store.update((current) => {
      const stillThere = new Set(current.holdings.map((h) => h.id));
      const safe = {
        found: plan.found.filter((f) => stillThere.has(f.id)),
        missing: plan.missing.filter((id) => stillThere.has(id)),
      };
      return applyPrices(current, safe, plan.found.length > 0, now());
    });
  }
  const status = result.status === "ok" ? "updated" : result.status;
  return { status, updated: plan.found.length, unavailable: plan.missing.length };
}

/** Wrap a refresh so two callers at once (two components, or two tabs' timers) share one run. */
export function onceAtATime<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let running: Promise<R> | null = null;
  return (...args) => {
    running ??= fn(...args).finally(() => {
      running = null;
    });
    return running;
  };
}
