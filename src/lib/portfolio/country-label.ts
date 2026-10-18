import { countryName } from "@/config/countries";
import { DIVERSIFIED } from "./sectors";
import type { Position } from "./types";

/**
 * What the Country column shows for an equity holding: the country's name for a stock (or for a fund that
 * tracks one country, once those are recognised), "Diversified" for a broad equity fund, otherwise empty.
 */
export function countryLabel(p: Pick<Position, "country" | "sector">): string {
  if (p.country) return countryName(p.country);
  return p.sector === DIVERSIFIED ? DIVERSIFIED : "";
}
