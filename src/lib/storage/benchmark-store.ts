// The browser's saved copy of the S&P 500 benchmark, and the weekly refresh. BROWSER ONLY. It lives under its own key, outside the
// saved portfolio, so nothing about a visitor's portfolio changes. Storage can be blocked, so every read and write is guarded.

import { benchmarkIsDue, checkBenchmark, type Benchmark } from "@/lib/market/benchmark";

const KEY = "portfolio-analyzer:benchmark";

/** The saved copy, or null (nothing saved, unreadable, or storage blocked). */
export function loadBenchmark(): Benchmark | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? checkBenchmark(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveBenchmark(b: Benchmark) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* blocked storage: the app just asks again next time */
  }
}

let inflight: Promise<Benchmark | null> | null = null;
let pausedUntil = 0;
/** After a failed lookup, wait this long before asking again (so a provider outage is not hit on every page). */
const FAILURE_PAUSE_MS = 10 * 60_000;

/**
 * Asks our server for the latest weights and saves them. Returns null on any failure (the caller keeps what it has). Pages that ask at
 * the same moment share one request, and after a failure it waits a few minutes before trying again.
 */
export function fetchBenchmark(): Promise<Benchmark | null> {
  if (inflight) return inflight;
  if (Date.now() < pausedUntil) return Promise.resolve(null);
  inflight = (async () => {
    try {
      const res = await fetch("/api/benchmark");
      const fresh = res.ok ? checkBenchmark(await res.json()) : null;
      if (fresh) saveBenchmark(fresh);
      else pausedUntil = Date.now() + FAILURE_PAUSE_MS;
      return fresh;
    } catch {
      pausedUntil = Date.now() + FAILURE_PAUSE_MS;
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Does the saved copy (or its absence) call for a new lookup? */
export const benchmarkDue = (saved: Benchmark | null, now: Date = new Date()) => !saved || benchmarkIsDue(saved.asOf, now);
