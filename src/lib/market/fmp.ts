// Calls to Financial Modeling Prep. SERVER ONLY: this reads FINANCIAL_MODELING_API_KEY, so it must
// only be imported from server actions / route handlers, never from a "use client" component.
// The key is never logged and never part of anything returned.

import { parseProfile, type MarketProfile } from "./profile";

const BASE = "https://financialmodelingprep.com/stable/profile";
const TIMEOUT_MS = 10_000;
const PARALLEL = 5;

export type FetchStatus =
  | "ok"
  | "no_key" // no key in .env.local
  | "limit" // the provider said a usage limit was hit (HTTP 429)
  | "unreachable"; // every request failed (offline, provider down)

export interface FetchResult {
  status: FetchStatus;
  /** Only tickers the provider answered for. null = answered, but no usable price. */
  profiles: Map<string, MarketProfile | null>;
}

/** Look up one ticker. Returns "limit" on HTTP 429, "error" on trouble, otherwise the profile or null. */
async function fetchOne(ticker: string, key: string): Promise<MarketProfile | null | "limit" | "error"> {
  try {
    const url = `${BASE}?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (res.status === 429) return "limit";
    // 402/403/404 mean this symbol isn't available on the plan: no price for it, but not a limit.
    if (res.status === 401 || res.status >= 500) return "error";
    if (!res.ok) return null;
    return parseProfile(await res.json());
  } catch {
    return "error";
  }
}

/** Look up many tickers, a few at a time. Stops early if the usage limit is hit. */
export async function fetchProfiles(tickers: string[]): Promise<FetchResult> {
  const key = process.env.FINANCIAL_MODELING_API_KEY?.trim();
  const profiles = new Map<string, MarketProfile | null>();
  if (!key) return { status: "no_key", profiles };

  const unique = [...new Set(tickers)];
  let next = 0;
  let limit = false;
  let errors = 0;
  const worker = async () => {
    while (!limit && next < unique.length) {
      const ticker = unique[next++];
      const r = await fetchOne(ticker, key);
      if (r === "limit") limit = true;
      else if (r === "error") errors++;
      else profiles.set(ticker, r);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, unique.length) }, worker));

  if (limit) return { status: "limit", profiles };
  if (unique.length > 0 && errors === unique.length) return { status: "unreachable", profiles };
  return { status: "ok", profiles };
}
