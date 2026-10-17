// Browser-side helpers that call our own API routes (the API key never reaches the browser).

import type { RawRow } from "@/lib/import/normalize";
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

/** Ask Claude (with web search) for the maturity / type of holdings. Returns values keyed by "Asset Class:TICKER". */
export async function lookupSubtypesWithClaude(items: ClassifyInput[]): Promise<Record<string, string>> {
  const res = await postAndParse<{ found: Record<string, string> }>("/api/holdings/classify", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return res.found;
}
