/** Opacity of the faintest amber (a country with a tiny exposure) so it still stands out from "no exposure" grey. */
export const FAINTEST = 0.35;

/**
 * How strongly a country is coloured, from `FAINTEST` up to 1 (full amber) for the biggest exposure. A square-root
 * scale lifts small exposures: with the biggest country at 70%, a 1% country is clearly visible, not almost invisible.
 * Zero (or less) exposure returns 0, meaning "not coloured" (the muted grey).
 */
export function exposureOpacity(weight: number, maxWeight: number): number {
  if (!(weight > 0) || !(maxWeight > 0)) return 0;
  const t = Math.sqrt(Math.min(1, weight / maxWeight));
  return FAINTEST + (1 - FAINTEST) * t;
}
