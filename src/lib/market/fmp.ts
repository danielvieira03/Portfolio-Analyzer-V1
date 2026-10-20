// Calls to Financial Modeling Prep. SERVER ONLY: this reads FINANCIAL_MODELING_API_KEY, so it must
// only be imported from server actions / route handlers, never from a "use client" component.
// The key is never logged and never part of anything returned.

import type { EtfBreakdown } from "@/lib/portfolio/types";
import { buildBreakdown, type FundRequest } from "./breakdown";
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

// ---- Fund breakdowns (sector and country weights of an ETF) ----

const ETF_BASE = "https://financialmodelingprep.com/stable/etf";

/**
 * The provider's own category for a fund ("Core Investment Grade Bond", "Commodities"), or null if it has none or anything
 * goes wrong. One extra call, made only when the Add form looks up an ETF (never during the price refresh).
 */
export async function fetchFundCategory(ticker: string): Promise<string | null> {
  const key = process.env.FINANCIAL_MODELING_API_KEY?.trim();
  if (!key) return null;
  try {
    const url = `${ETF_BASE}/info?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const category = Array.isArray(json) ? (json[0] as { assetClass?: unknown } | undefined)?.assetClass : null;
    return typeof category === "string" && category.trim() ? category.trim() : null;
  } catch {
    return null;
  }
}

export type BreakdownStatus =
  | "ok"
  | "no_key"
  | "limit" // HTTP 429
  | "restricted" // HTTP 402/403: this data is not included in the plan
  | "unreachable"; // every lookup failed (offline, provider down)

export interface BreakdownResult {
  status: BreakdownStatus;
  /** Only funds the provider fully answered for (both lists, "no data" included). Anything missing keeps its saved data. */
  breakdowns: Map<string, EtfBreakdown>;
}

/** One list for one fund: its JSON, "empty" when the provider has none, or why it failed. */
async function fetchWeights(path: string, ticker: string, key: string): Promise<unknown | "empty" | "limit" | "restricted" | "error"> {
  try {
    const url = `${ETF_BASE}/${path}?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (res.status === 429) return "limit";
    if (res.status === 402 || res.status === 403) return "restricted";
    if (res.status === 404) return "empty";
    if (!res.ok) return "error";
    return await res.json();
  } catch {
    return "error";
  }
}

/**
 * Look up the sector and country weights of many funds, a few at a time (2 calls per equity ETF, 1 per bond fund). A usage limit stops the
 * run; a fund the plan doesn't cover, or that failed, is skipped (never recorded as "no data", so saved data stays).
 * Funds answered are always returned so they can be saved.
 */
export async function fetchBreakdowns(funds: FundRequest[], now: Date = new Date()): Promise<BreakdownResult> {
  const key = process.env.FINANCIAL_MODELING_API_KEY?.trim();
  const breakdowns = new Map<string, EtfBreakdown>();
  if (!key) return { status: "no_key", breakdowns };

  const unique = [...new Map(funds.map((f) => [f.ticker, f])).values()];
  let next = 0;
  let limit = false;
  let restricted = 0;
  let errors = 0;
  const worker = async () => {
    while (!limit && next < unique.length) {
      const { ticker, sectors: wantSectors } = unique[next++];
      const [sectors, countries] = await Promise.all([
        wantSectors ? fetchWeights("sector-weightings", ticker, key) : Promise.resolve("empty" as const),
        fetchWeights("country-weightings", ticker, key),
      ]);
      const answers = [sectors, countries];
      if (answers.includes("limit")) limit = true;
      else if (answers.includes("restricted")) restricted++;
      else if (answers.includes("error")) errors++;
      else breakdowns.set(ticker, buildBreakdown(sectors === "empty" ? [] : sectors, countries === "empty" ? [] : countries, now));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, unique.length) }, worker));

  if (limit) return { status: "limit", breakdowns };
  if (unique.length > 0 && breakdowns.size === 0) {
    if (restricted > 0) return { status: "restricted", breakdowns };
    if (errors === unique.length) return { status: "unreachable", breakdowns };
  }
  return { status: "ok", breakdowns };
}
