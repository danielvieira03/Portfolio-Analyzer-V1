import { countryName } from "@/config/countries";
import { marketValue } from "./calc";
import { DIVERSIFIED } from "./sectors";
import type { EtfBreakdown, HoldingClass, Position } from "./types";

/** Label for the part of a view whose sector or country is not known (a fund with missing weights, a stock with no data yet). */
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
  /** Market value of everything counted in this view, classified or not. */
  total: number;
  /** The part that has a sector / country. */
  classified: number;
  /** The part with no sector / country, as a value and a fraction of `total`. */
  unclassified: { value: number; weight: number };
  /** Sectors / countries, biggest first. */
  rows: ExposureRow[];
  /** Funds counted in this view that have no usable breakdown at all (no record, or the provider had nothing). */
  fundsWithoutData: number;
  /** Oldest "last updated" among the breakdowns used in this view (ISO), or null if none were used. */
  oldestBreakdown: string | null;
}

/** One bond fund's part of the duration view. */
export interface DurationRow {
  ticker: string;
  name: string;
  value: number;
  /** Duration in years. */
  years: number;
  /** The fund's share of the bond funds that have a duration (a fraction; the rows add up to 1). */
  weight: number;
  /** What the fund adds to the average duration, in years (`years` x `weight`; the rows add up to the average). */
  contribution: number;
}

export interface DurationView {
  /** Market value of every holding counted in this view (bond funds), with a duration or not. */
  total: number;
  /** The part of `total` whose fund has a duration. */
  covered: number;
  /** Market-value-weighted average duration in years of the funds that have one; null when none does. */
  average: number | null;
  /** The funds that have a duration, biggest (by market value) first. */
  rows: DurationRow[];
  /** Counted funds with no duration yet. */
  withoutDuration: { ticker: string; name: string }[];
}

export interface LookThroughExposure {
  sector: ExposureView;
  country: ExposureView;
  duration: DurationView;
}

export interface ExposureOptions {
  /** Asset classes counted in the sector view. Default: Equities only (sector charts are about equities). */
  sectorClasses?: readonly HoldingClass[];
  /** Asset classes counted in the country view. Default: Equities and Fixed Income (bond funds have a country split). */
  countryClasses?: readonly HoldingClass[];
  /** Duration in years by upper-case ticker (see `fundDurations`). Without it no fund has a duration. */
  durations?: Record<string, number>;
  /** Asset classes counted in the duration view. Default: Fixed Income only. */
  durationClasses?: readonly HoldingClass[];
}

type Dimension = "sector" | "country";

/**
 * The ONE place that works out where a portfolio's money sits by sector and by country, for individual stocks AND
 * funds (ETFs, bond funds, alternatives). An individual stock counts 100% to its own sector and country. A fund's
 * value is split using its saved breakdown ($10,000 in a fund that is 30% Technology adds $3,000 to Technology);
 * whatever the weights don't cover (under 100%, no data, names the app can't match) goes to "Unclassified".
 *
 * Each view has its own scope: by default sectors count equities only, countries count equities and bond funds.
 * A holding outside a view's scope is simply not part of it (it is NOT unclassified).
 *
 * Every exposure feature (cards, charts, risk checks, future bond-duration views) must use this, so it covers
 * stocks, ETFs, bond funds and alternatives, not equities only.
 */
export function lookThroughExposure(
  positions: Position[],
  breakdowns: Record<string, EtfBreakdown>,
  opts: ExposureOptions = {},
): LookThroughExposure {
  return {
    sector: dimensionView(positions, breakdowns, "sector", opts.sectorClasses ?? ["Equities"]),
    country: dimensionView(positions, breakdowns, "country", opts.countryClasses ?? ["Equities", "Fixed Income"]),
    duration: durationView(positions, opts.durations ?? {}, opts.durationClasses ?? ["Fixed Income"]),
  };
}

/**
 * Average duration of the holdings in scope: each fund's duration weighted by its market value. A fund with no duration
 * is left out of the average (and listed in `withoutDuration`), so the average is never dragged down by a missing number.
 */
function durationView(positions: Position[], durations: Record<string, number>, classes: readonly HoldingClass[]): DurationView {
  let total = 0;
  const rows = new Map<string, Omit<DurationRow, "weight" | "contribution">>();
  const missing = new Map<string, { ticker: string; name: string }>();
  for (const p of positions) {
    if (!classes.includes(p.assetClass)) continue;
    const value = marketValue(p);
    if (!(value > 0)) continue;
    total += value;
    const ticker = p.ticker.toUpperCase();
    const years = durations[ticker];
    if (typeof years === "number" && years > 0) {
      const row = rows.get(ticker);
      rows.set(ticker, { ticker, name: p.name, value: (row?.value ?? 0) + value, years });
    } else if (!missing.has(ticker)) {
      missing.set(ticker, { ticker, name: p.name });
    }
  }
  const sorted = [...rows.values()].sort((a, b) => b.value - a.value || a.ticker.localeCompare(b.ticker));
  const covered = sorted.reduce((t, r) => t + r.value, 0);
  const list = sorted.map((r) => {
    const weight = covered > 0 ? r.value / covered : 0;
    return { ...r, weight, contribution: r.years * weight };
  });
  return {
    total,
    covered,
    average: covered > 0 ? list.reduce((t, r) => t + r.contribution, 0) : null,
    rows: list,
    withoutDuration: [...missing.values()],
  };
}

function dimensionView(
  positions: Position[],
  breakdowns: Record<string, EtfBreakdown>,
  dim: Dimension,
  classes: readonly HoldingClass[],
): ExposureView {
  const values = new Map<string, number>();
  let total = 0;
  let unclassified = 0;
  let fundsWithoutData = 0;
  let oldest: string | null = null;

  for (const p of positions) {
    if (!classes.includes(p.assetClass)) continue;
    const value = marketValue(p);
    if (!(value > 0)) continue;
    total += value;

    // An individual stock: 100% to its own sector / country.
    if (p.assetClass === "Equities" && p.sector !== DIVERSIFIED) {
      const key = dim === "sector" ? p.sector : p.country;
      if (key) values.set(key, (values.get(key) ?? 0) + value);
      else unclassified += value;
      continue;
    }

    // A fund: split by its saved weights.
    const b = breakdowns[p.ticker.toUpperCase()];
    if (!b || b.status !== "ok") {
      fundsWithoutData++;
      unclassified += value;
      continue;
    }
    if (oldest === null || b.updatedAt < oldest) oldest = b.updatedAt;
    const parts = dim === "sector" ? b.sectors.map((s) => ({ key: s.name, fraction: s.weight })) : b.countries.map((c) => ({ key: c.code, fraction: c.weight }));
    let used = 0;
    for (const { key, fraction } of normalise(parts)) {
      values.set(key, (values.get(key) ?? 0) + value * fraction);
      used += fraction;
    }
    unclassified += value * Math.max(0, 1 - used);
  }

  const label = dim === "sector" ? (k: string) => k : countryName;
  const rows = [...values.entries()]
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, label: label(key), value, weight: total === 0 ? 0 : value / total }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const rest = Math.max(0, unclassified);
  return {
    total,
    classified: rows.reduce((t, r) => t + r.value, 0),
    unclassified: { value: rest, weight: total === 0 ? 0 : rest / total },
    rows,
    fundsWithoutData,
    oldestBreakdown: oldest,
  };
}

/** Drops empty weights and scales down a set that adds up to more than 100% (rounding in the data). */
function normalise(parts: { key: string; fraction: number }[]) {
  const valid = parts.filter((p) => p.fraction > 0);
  const sum = valid.reduce((t, p) => t + p.fraction, 0);
  return sum > 1 ? valid.map((p) => ({ key: p.key, fraction: p.fraction / sum })) : valid;
}
