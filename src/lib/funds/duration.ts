// Which duration (years) each bond fund has, and which funds still need one looked up. Pure: no network, no browser.

import type { FundRecord } from "@/lib/funds/library";
import type { DurationRecord, Position } from "@/lib/portfolio/types";

/** A fund Claude found no duration for is asked about again only after this many days. */
export const DURATION_RETRY_DAYS = 7;
/** The most funds looked up in one run. */
export const DURATION_MAX_PER_RUN = 10;

const valid = (years: unknown): years is number => typeof years === "number" && Number.isFinite(years) && years > 0;

/**
 * Duration in years by upper-case ticker for the Fixed Income funds held. Sources, in order: the fund library
 * (built-in list first, then funds looked up for this visitor), then durations looked up one by one (`saved`).
 * `library` is every library record for the held tickers (see `libraryFunds`).
 */
export function fundDurations(positions: Pick<Position, "ticker" | "assetClass">[], library: FundRecord[], saved: Record<string, DurationRecord>): Record<string, number> {
  const fromLibrary = new Map<string, number>();
  for (const f of library) {
    const t = f.ticker.toUpperCase();
    if (f.assetClass === "Fixed Income" && valid(f.durationYears) && !fromLibrary.has(t)) fromLibrary.set(t, f.durationYears);
  }
  const out: Record<string, number> = {};
  for (const p of positions) {
    if (p.assetClass !== "Fixed Income") continue;
    const t = p.ticker.toUpperCase();
    const years = fromLibrary.get(t) ?? saved[t]?.years;
    if (valid(years)) out[t] = years;
  }
  return out;
}

/**
 * Fixed Income funds that have no duration from any source and were not asked about within the last week, ready for a
 * lookup (at most `DURATION_MAX_PER_RUN`, upper-case tickers, no repeats).
 */
export function durationsDue(
  positions: Pick<Position, "ticker" | "name" | "assetClass">[],
  library: FundRecord[],
  saved: Record<string, DurationRecord>,
  now: Date,
): { ticker: string; name: string; assetClass: "Fixed Income" }[] {
  const have = fundDurations(positions, library, saved);
  const out = new Map<string, { ticker: string; name: string; assetClass: "Fixed Income" }>();
  for (const p of positions) {
    if (p.assetClass !== "Fixed Income") continue;
    const t = p.ticker.toUpperCase();
    if (have[t] !== undefined || out.has(t)) continue;
    const tried = saved[t];
    if (tried && now.getTime() - Date.parse(tried.checkedAt) < DURATION_RETRY_DAYS * 86_400_000) continue;
    out.set(t, { ticker: t, name: p.name, assetClass: "Fixed Income" });
  }
  return [...out.values()].slice(0, DURATION_MAX_PER_RUN);
}
