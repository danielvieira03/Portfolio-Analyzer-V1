"use server";

// Server side of the market data lookups. These are STATELESS: they receive tickers from the visitor's
// browser, ask the market data provider with the server's key, and send the answers back. Nothing about
// anyone's portfolio is stored or read here. (Next.js itself checks that server actions are called
// from this app's own pages.)

import { fetchProfiles, type FetchStatus } from "@/lib/market/fmp";
import type { MarketProfile } from "@/lib/market/profile";

/** A safety cap on one request (a normal portfolio has a few dozen holdings), not a usage limit. */
const MAX_TICKERS = 200;
const TICKER = /^[A-Z0-9.^=\-]{1,12}$/;

export interface PriceFetchResult {
  status: FetchStatus;
  /** Only tickers the provider answered for; null = answered, but no usable price. */
  profiles: Record<string, MarketProfile | null>;
}

/** Market data for many tickers (prices refresh). */
export async function fetchPricesAction(tickers: string[]): Promise<PriceFetchResult> {
  const clean = [
    ...new Set(
      (Array.isArray(tickers) ? tickers : [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => TICKER.test(t)),
    ),
  ].slice(0, MAX_TICKERS);
  if (clean.length === 0) return { status: "ok", profiles: {} };
  const result = await fetchProfiles(clean);
  return { status: result.status, profiles: Object.fromEntries(result.profiles) };
}

/** Market data for one ticker (form autofill). Never throws: no data simply means "enter it by hand". */
export async function lookupProfileAction(ticker: string): Promise<MarketProfile | null> {
  const t = typeof ticker === "string" ? ticker.trim().toUpperCase() : "";
  if (!TICKER.test(t)) return null;
  const { profiles } = await fetchProfiles([t]);
  return profiles.get(t) ?? null;
}
