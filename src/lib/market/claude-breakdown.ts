// Checks sector weights that Claude read from a fund page before they are saved. Pure: no network.

import { translateSectorName } from "./breakdown";
import { DIVERSIFIED } from "@/lib/portfolio/sectors";

/** A set of sector weights is only believed when it covers most of the fund (cash and rounding explain a little under) but not much more than all of it. */
export const MIN_TOTAL_PERCENT = 90;
export const MAX_TOTAL_PERCENT = 105;

/**
 * Claude's sector percentages (any spelling of the sector names) as saved weights: names translated to the app's, repeats added,
 * "Diversified" and unknown names dropped, a total a little over 100% scaled back to 100%. Null when the answer is not believable
 * (nothing usable, or the total is under 90% or over 105%), so nothing wrong is ever saved.
 */
export function sectorWeightsFromPercents(items: { sector: string; percent: number }[]): { name: string; weight: number }[] | null {
  const totals = new Map<string, number>();
  for (const { sector, percent } of items) {
    if (!(typeof percent === "number" && Number.isFinite(percent) && percent > 0 && percent <= 100)) continue;
    const name = sector.trim().toLowerCase() === DIVERSIFIED.toLowerCase() ? undefined : translateSectorName(sector);
    if (name) totals.set(name, (totals.get(name) ?? 0) + percent);
  }
  const total = [...totals.values()].reduce((t, v) => t + v, 0);
  if (total < MIN_TOTAL_PERCENT || total > MAX_TOTAL_PERCENT) return null;
  const scale = total > 100 ? 100 / total : 1;
  return [...totals.entries()].map(([name, percent]) => ({ name, weight: (percent * scale) / 100 })).sort((a, b) => b.weight - a.weight);
}
