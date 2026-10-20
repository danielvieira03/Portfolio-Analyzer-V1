import { DURATION_BANDS } from "@/config/risk";
import type { DurationView } from "./exposure";

/** The average as shown on screen: one decimal. */
export const displayDuration = (years: number) => Math.round(years * 10) / 10;

/** The index (0 = ultra-short ... 3 = long) of the duration type for an average duration in years. */
export function durationBandIndex(years: number): number {
  const shown = displayDuration(years);
  const i = DURATION_BANDS.findIndex((b) => shown < b.below);
  return i === -1 ? DURATION_BANDS.length - 1 : i;
}

/**
 * Duration type for an average duration: under 1 year ultra-short, 1 up to 3 short, 3 up to 7 intermediate, 7 and over long.
 * Compares the average as displayed (one decimal), so the number on screen and the label never disagree.
 */
export const durationType = (years: number): string => DURATION_BANDS[durationBandIndex(years)].label;

/** A bond fund's place in "where the duration comes from". */
export interface Contributor {
  ticker: string;
  name: string;
  /** Share of the bond funds that have a duration (a fraction). */
  weight: number;
  years: number;
  /** What it adds to the average duration, in years. */
  contribution: number;
  /** `contribution` as a fraction of the average duration. */
  shareOfDuration: number;
}

/**
 * The funds that add the most to the average duration, largest first (a small long-duration fund can outrank a big short one).
 * Ties go to the bigger holding, then the ticker. Fewer funds than `n` simply gives all of them.
 */
export function topContributors(view: Pick<DurationView, "rows" | "average">, n = 5): Contributor[] {
  const average = view.average;
  if (!average) return [];
  return [...view.rows]
    .sort((a, b) => b.contribution - a.contribution || b.value - a.value || a.ticker.localeCompare(b.ticker))
    .slice(0, n)
    .map((r) => ({ ticker: r.ticker, name: r.name, weight: r.weight, years: r.years, contribution: r.contribution, shareOfDuration: r.contribution / average }));
}
