// The S&P 500 sector benchmark the Risk Analysis chart compares against: SPY's sector weights from the market data
// provider, refreshed about weekly. Pure and unit-tested; the server fetch is in fmp.ts, the browser copy in
// `lib/storage/benchmark-store.ts`. The fallback numbers live in `src/config/sp500-sectors.ts`.

import { SP500_AS_OF, SP500_SECTOR_WEIGHTS } from "@/config/sp500-sectors";
import { SECTORS, type Sector } from "@/lib/portfolio/sectors";
import { parseSectorWeights } from "./breakdown";

/** The fund whose sector weights stand in for the S&P 500 (the provider has no index weights on this plan). */
export const BENCHMARK_FUND = "SPY";
/** The benchmark is looked up again after this long. */
export const BENCHMARK_REFRESH_DAYS = 7;

export interface Benchmark {
  /** Weights in percent (33.9 = 33.9%), one per sector. */
  weights: Record<Sector, number>;
  /** The day (YYYY-MM-DD) these weights were looked up. */
  asOf: string;
}

/** The built-in copy, used until a lookup has worked (and whenever it fails). */
export const FALLBACK_BENCHMARK: Benchmark = { weights: SP500_SECTOR_WEIGHTS, asOf: SP500_AS_OF };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Weights are usable when all 11 sectors are there, each positive, adding up to about 100%. */
export function validWeights(w: unknown): w is Record<Sector, number> {
  if (!w || typeof w !== "object") return false;
  const rec = w as Record<string, unknown>;
  let total = 0;
  for (const s of SECTORS) {
    const v = rec[s];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 100) return false;
    total += v;
  }
  return total >= 97 && total <= 103;
}

/** SPY's sector list from the provider, in the app's sector names; null unless it is complete and adds up. `today` is YYYY-MM-DD. */
export function parseBenchmark(json: unknown, today: string): Benchmark | null {
  const weights: Partial<Record<Sector, number>> = {};
  for (const { name, weight } of parseSectorWeights(json)) weights[name as Sector] = Math.round(weight * 10_000) / 100;
  return validWeights(weights) && ISO_DAY.test(today) ? { weights, asOf: today } : null;
}

/** A benchmark read back from storage or from our own route; null when it isn't a valid one. */
export function checkBenchmark(raw: unknown): Benchmark | null {
  if (!raw || typeof raw !== "object") return null;
  const { weights, asOf } = raw as { weights?: unknown; asOf?: unknown };
  return validWeights(weights) && typeof asOf === "string" && ISO_DAY.test(asOf) ? { weights, asOf } : null;
}

/** Is this copy old enough to look up again? A date we can't read counts as old. */
export function benchmarkIsDue(asOf: string, now: Date, days = BENCHMARK_REFRESH_DAYS): boolean {
  const t = Date.parse(`${asOf}T00:00:00Z`);
  return !Number.isFinite(t) || now.getTime() - t >= days * 86_400_000;
}
