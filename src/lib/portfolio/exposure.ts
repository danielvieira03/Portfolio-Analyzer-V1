import { countryName } from "@/config/countries";
import { marketValue } from "./calc";
import { DIVERSIFIED } from "./sectors";
import type { EtfBreakdown, HoldingClass, Position } from "./types";

/** Label for the part of a portfolio whose sector or country is not known (a fund with missing weights, a stock with no data yet). */
export const UNCLASSIFIED = "Unclassified";

export interface ExposureRow {
  /** Sector name, or ISO two-letter country code. */
  key: string;
  label: string;
  value: number;
  /** Fraction of `total` (so it includes the unclassified part). */
  weight: number;
}

export interface ExposureView {
  /** Market value of everything counted, classified or not. */
  total: number;
  /** The part that has a sector / country. */
  classified: number;
  /** The part with no sector / country, as a value and a fraction of `total`. */
  unclassified: { value: number; weight: number };
  /** Sectors / countries, biggest first. */
  rows: ExposureRow[];
}

export interface LookThroughExposure {
  sector: ExposureView;
  country: ExposureView;
  /** Funds counted that have no usable breakdown at all (no record, or the provider had nothing). */
  fundsWithoutData: number;
  /** Oldest "last updated" among the breakdowns used (ISO), or null if none were used. */
  oldestBreakdown: string | null;
}

export interface ExposureOptions {
  /** Which asset classes to count. Default: Equities only (cash is never a position). */
  assetClasses?: readonly HoldingClass[];
}

type Parts = { key: string; fraction: number }[];

/**
 * The ONE place that works out where a portfolio's money sits by sector and by country, for individual stocks AND
 * funds (ETFs, bond funds, alternatives). An individual stock counts 100% to its own sector and country. A fund's
 * value is split using its saved breakdown ($10,000 in a fund that is 30% Technology adds $3,000 to Technology);
 * whatever the weights don't cover (under 100%, no data, names the app can't match) goes to "Unclassified".
 *
 * Every exposure feature (cards, charts, risk checks, future bond-duration views) must use this, so it covers
 * stocks, ETFs, bond funds and alternatives, not equities only.
 */
export function lookThroughExposure(
  positions: Position[],
  breakdowns: Record<string, EtfBreakdown>,
  opts: ExposureOptions = {},
): LookThroughExposure {
  const classes = opts.assetClasses ?? ["Equities"];
  const sectorValues = new Map<string, number>();
  const countryValues = new Map<string, number>();
  const unclassified = { sector: 0, country: 0 };
  let total = 0;
  let fundsWithoutData = 0;
  let oldest: string | null = null;

  const spread = (value: number, parts: Parts, into: Map<string, number>, other: "sector" | "country") => {
    let used = 0;
    for (const { key, fraction } of parts) {
      into.set(key, (into.get(key) ?? 0) + value * fraction);
      used += fraction;
    }
    unclassified[other] += value * Math.max(0, 1 - used);
  };

  for (const p of positions) {
    if (!classes.includes(p.assetClass)) continue;
    const value = marketValue(p);
    if (!(value > 0)) continue;
    total += value;

    const isStock = p.assetClass === "Equities" && p.sector !== DIVERSIFIED;
    if (isStock) {
      spread(value, p.sector ? [{ key: p.sector, fraction: 1 }] : [], sectorValues, "sector");
      spread(value, p.country ? [{ key: p.country, fraction: 1 }] : [], countryValues, "country");
      continue;
    }

    const b = breakdowns[p.ticker.toUpperCase()];
    if (!b || b.status !== "ok") {
      fundsWithoutData++;
      unclassified.sector += value;
      unclassified.country += value;
      continue;
    }
    if (oldest === null || b.updatedAt < oldest) oldest = b.updatedAt;
    spread(value, normalise(b.sectors.map((s) => ({ key: s.name, fraction: s.weight }))), sectorValues, "sector");
    spread(value, normalise(b.countries.map((c) => ({ key: c.code, fraction: c.weight }))), countryValues, "country");
  }

  return {
    sector: view(total, sectorValues, unclassified.sector, (k) => k),
    country: view(total, countryValues, unclassified.country, countryName),
    fundsWithoutData,
    oldestBreakdown: oldest,
  };
}

/** Drops empty weights and scales down a set that adds up to more than 100% (rounding in the data). */
function normalise(parts: Parts): Parts {
  const valid = parts.filter((p) => p.fraction > 0);
  const sum = valid.reduce((t, p) => t + p.fraction, 0);
  return sum > 1 ? valid.map((p) => ({ key: p.key, fraction: p.fraction / sum })) : valid;
}

function view(total: number, values: Map<string, number>, unclassifiedValue: number, label: (key: string) => string): ExposureView {
  const rows = [...values.entries()]
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, label: label(key), value, weight: total === 0 ? 0 : value / total }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const classified = rows.reduce((t, r) => t + r.value, 0);
  const rest = Math.max(0, unclassifiedValue);
  return {
    total,
    classified,
    unclassified: { value: rest, weight: total === 0 ? 0 : rest / total },
    rows,
  };
}
