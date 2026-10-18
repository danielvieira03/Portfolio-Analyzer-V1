// Decides what a price refresh changes. Pure: no network, no database.

import type { MarketProfile } from "./profile";

export interface PriceTarget {
  id: string;
  ticker: string;
  assetClass: string;
}

export interface PricePlan {
  /** Holdings that got a price: save it and clear any "manual" flag. */
  found: { id: string; price: number; /** Stocks only: headquarters country, when the provider gave one. */ country?: string | null }[];
  /** Holdings the provider answered for but has no price: keep the manual price, flag it. */
  missing: string[];
}

/**
 * `profiles` only holds tickers the provider actually answered for (null = answered, no data).
 * A ticker that is absent (usage limit, network trouble) is left completely alone.
 */
export function planPriceUpdates(targets: PriceTarget[], profiles: Map<string, MarketProfile | null>): PricePlan {
  const plan: PricePlan = { found: [], missing: [] };
  for (const t of targets) {
    if (!profiles.has(t.ticker)) continue;
    const p = profiles.get(t.ticker);
    if (p) plan.found.push({ id: t.id, price: p.price, ...(t.assetClass === "Equities" && p.country ? { country: p.country } : {}) });
    else plan.missing.push(t.id);
  }
  return plan;
}

/**
 * How often a page should ask "are prices due?". Checking several times per interval makes refreshes land close
 * to on time (a refresh is stamped when it FINISHES, so checking only once per interval would often miss by a
 * moment and wait a whole extra interval). Between 15 and 60 seconds.
 */
export function checkEveryMs(minutes: number): number {
  return Math.max(15_000, Math.min(60_000, (minutes * 60_000) / 4));
}

/** True when prices were never updated, or the last update is `minutes` old or older. */
export function isStale(lastUpdated: Date | null, now: Date, minutes: number): boolean {
  if (!lastUpdated) return true;
  return now.getTime() - lastUpdated.getTime() >= minutes * 60_000;
}
