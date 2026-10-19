import { lookThroughExposure } from "./exposure";
import type { EtfBreakdown, Position } from "./types";

export interface CountryRow {
  /** ISO two-letter code. */
  code: string;
  name: string;
  value: number;
  /** Fraction of the holdings that have a country (0 to 1), so the rows add up to 100%. */
  weight: number;
}

export interface CountryExposure {
  /** Market value of the part that has a country. */
  total: number;
  /** Countries, biggest first. */
  rows: CountryRow[];
  /** The part with no country (a fund with missing weights, a stock with no country yet), as a share of everything counted. */
  unclassified: { value: number; weight: number };
  /** Funds counted that have no usable breakdown at all. */
  fundsWithoutData: number;
  /** Oldest "last updated" among the fund breakdowns used (ISO), or null. */
  oldestBreakdown: string | null;
}

/**
 * Where the money is, by country: individual stocks (by headquarters), equity ETFs and bond funds (split by their
 * country weights), through `lookThroughExposure`, the shared exposure function. Alternatives and cash are not part of
 * this. Percentages are shares of the part that has a country (so they add up to 100%); the part without one is
 * reported separately as `unclassified`.
 */
export function countryExposure(positions: Position[], breakdowns: Record<string, EtfBreakdown> = {}): CountryExposure {
  const { country } = lookThroughExposure(positions, breakdowns);
  return {
    total: country.classified,
    rows: country.rows.map((r) => ({
      code: r.key,
      name: r.label,
      value: r.value,
      weight: country.classified === 0 ? 0 : r.value / country.classified,
    })),
    unclassified: country.unclassified,
    fundsWithoutData: country.fundsWithoutData,
    oldestBreakdown: country.oldestBreakdown,
  };
}
