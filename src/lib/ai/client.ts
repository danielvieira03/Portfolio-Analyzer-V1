// Browser-side helpers that call our own API routes (the API key never reaches the browser).

import { resolveSubtypes, type ClaudeLookup } from "@/lib/funds/resolve";
import type { RawRow } from "@/lib/import/normalize";
import { addLearnedFunds, libraryFunds } from "@/lib/portfolio/ledger";
import { getBrowserStore } from "@/lib/storage/browser";
import type { Review } from "./schema";

async function postAndParse<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", ...init });
  } catch {
    throw new Error("Couldn’t reach the app. Is it still running?");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export interface ExtractResult {
  headers: string[];
  rows: RawRow[];
  issues: string[];
}

/** Send a screenshot or PDF to Claude (via our server) and get importable rows back. */
export async function readWithClaude(file: File): Promise<ExtractResult> {
  const form = new FormData();
  form.append("file", file);
  return postAndParse<ExtractResult>("/api/import/extract", { body: form });
}

export interface ReviewInputRow {
  ticker: string;
  name: string;
  assetClass: string;
  sector: string | null;
  shares: number;
  costBasisPerShare: number;
  currentPrice: number;
}

/** Ask Claude to sanity-check parsed rows (text only). */
export async function reviewWithClaude(rows: ReviewInputRow[]): Promise<Review> {
  return postAndParse<Review>("/api/import/review", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}

export interface ClassifyInput {
  ticker: string;
  name: string;
  assetClass: "Fixed Income" | "Alternatives";
}

/**
 * Find the maturity / type of holdings. This visitor's own fund library answers first (free); only funds it
 * doesn't know are sent to Claude (with web search), and what Claude finds is saved in this browser's library.
 * Returns values keyed by "Asset Class:TICKER".
 */
export async function lookupSubtypesWithClaude(items: ClassifyInput[]): Promise<Record<string, string>> {
  const store = getBrowserStore();
  const res = await resolveSubtypes(items, {
    getLibrary: async (tickers) => libraryFunds(store.getSnapshot().doc, tickers),
    lookup: async (unknown) => {
      const r = await postAndParse<ClaudeLookup & { ok: true }>("/api/holdings/classify", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: unknown }),
      });
      return { found: r.found, durations: r.durations ?? {}, usage: r.usage, searches: r.searches };
    },
    save: async (funds) => store.update((doc) => addLearnedFunds(doc, funds)),
  });
  return res.found;
}

/** Ask Claude for the sector of equity holdings the market data had none for. Returns sectors by upper-case ticker. */
export async function lookupSectorsWithClaude(items: { ticker: string; name: string }[]): Promise<Record<string, string>> {
  const r = await postAndParse<{ ok: true; found: Record<string, string> }>("/api/holdings/sector", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return r.found;
}

/**
 * Ask Claude (with web search, the same lookup as maturity / type) for the duration in years of bond funds.
 * Returns the durations it read, by upper-case ticker; a fund it found none for is simply missing.
 */
export async function lookupDurationsWithClaude(items: { ticker: string; name: string }[]): Promise<Record<string, number>> {
  const r = await postAndParse<{ ok: true; durations?: Record<string, number> }>("/api/holdings/classify", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: items.map((i) => ({ ticker: i.ticker, name: i.name, assetClass: "Fixed Income" })) }),
  });
  const out: Record<string, number> = {};
  for (const [key, years] of Object.entries(r.durations ?? {})) {
    if (typeof years === "number" && years > 0) out[key.replace(/^Fixed Income:/, "").toUpperCase()] = years;
  }
  return out;
}

/**
 * Ask Claude (with web search) to read the sector weights of equity ETFs the market data has none for.
 * Returns believable weights by upper-case ticker (fractions); a fund it could not read is simply missing.
 */
export async function lookupBreakdownsWithClaude(items: { ticker: string; name: string }[]): Promise<Record<string, { name: string; weight: number }[]>> {
  const r = await postAndParse<{ ok: true; found: Record<string, { name: string; weight: number }[]> }>("/api/holdings/breakdown", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return r.found ?? {};
}
