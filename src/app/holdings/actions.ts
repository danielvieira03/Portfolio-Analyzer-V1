"use server";

// Server side of the market data lookups. These are STATELESS: they receive tickers from the visitor's
// browser, ask the market data provider with the server's key, and send the answers back. Nothing about
// anyone's portfolio is stored or read here. (Next.js itself checks that server actions are called
// from this app's own pages.)

import { BREAKDOWN_MAX_PER_REFRESH } from "@/config/market";
import { fetchBreakdowns, fetchFundCategory, fetchProfiles, type BreakdownStatus, type FetchStatus } from "@/lib/market/fmp";
import type { MarketProfile } from "@/lib/market/profile";
import type { FundRequest } from "@/lib/market/breakdown";
import type { EtfBreakdown } from "@/lib/portfolio/types";

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
  const profile = profiles.get(t) ?? null;
  // A fund's category tells the form which asset class it belongs to (one extra call, funds only).
  return profile?.isEtf ? { ...profile, category: await fetchFundCategory(t) } : profile;
}

export interface BreakdownFetchResult {
  status: BreakdownStatus;
  /** Only funds the provider fully answered for. */
  breakdowns: Record<string, EtfBreakdown>;
}

/** Sector and country weights for a few funds (the weekly refresh). Stateless, like the price lookups. */
export async function fetchBreakdownsAction(funds: FundRequest[]): Promise<BreakdownFetchResult> {
  const clean: FundRequest[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(funds) ? funds : []) {
    const ticker = typeof f?.ticker === "string" ? f.ticker.trim().toUpperCase() : "";
    if (!TICKER.test(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    clean.push({ ticker, sectors: f.sectors !== false });
    if (clean.length >= BREAKDOWN_MAX_PER_REFRESH) break;
  }
  if (clean.length === 0) return { status: "ok", breakdowns: {} };
  const result = await fetchBreakdowns(clean);
  return { status: result.status, breakdowns: Object.fromEntries(result.breakdowns) };
}
