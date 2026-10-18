import { countryName } from "@/config/countries";
import { marketValue } from "./calc";
import { DIVERSIFIED } from "./sectors";
import type { Position } from "./types";

export interface CountryRow {
  /** ISO two-letter code. */
  code: string;
  name: string;
  value: number;
  /** Fraction of the individual stocks that have a country (0 to 1). */
  weight: number;
}

export interface CountryExposure {
  /** Market value of the individual stocks that have a country. */
  total: number;
  /** Countries, biggest first. */
  rows: CountryRow[];
  /** Individual stocks whose country isn't known yet (left out of the percentages). */
  withoutCountry: number;
}

/**
 * Where the individual stocks are based, as shares of the individual stocks that have a country. Broad equity
 * funds (sector "Diversified"), bond funds, alternatives and cash are not part of this.
 */
export function countryExposure(positions: Position[]): CountryExposure {
  const byCode = new Map<string, number>();
  let withoutCountry = 0;
  for (const p of positions) {
    if (p.assetClass !== "Equities" || p.sector === DIVERSIFIED) continue;
    if (!p.country) {
      withoutCountry++;
      continue;
    }
    byCode.set(p.country, (byCode.get(p.country) ?? 0) + marketValue(p));
  }
  const entries = [...byCode.entries()].filter(([, value]) => value > 0);
  const total = entries.reduce((t, [, value]) => t + value, 0);
  const rows = entries
    .map(([code, value]) => ({ code, name: countryName(code), value, weight: total === 0 ? 0 : value / total }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { total, rows, withoutCountry };
}
