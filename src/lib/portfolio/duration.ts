import { DURATION_BANDS } from "@/config/risk";

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
