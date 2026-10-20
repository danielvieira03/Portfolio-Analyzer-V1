// Fills in what an imported file left blank (sector, country, maturity / type) while the preview is open.
// Pure: market data answers and Claude's answers come in as plain values. A value that is already in the file
// is never replaced.

import type { HoldingInput } from "@/lib/holdings/schema";
import { SECTOR_OPTIONS } from "@/lib/holdings/schema";
import { equitySector, type MarketProfile } from "@/lib/market/profile";
import { DIVERSIFIED } from "@/lib/portfolio/sectors";

/** What was looked up for one row. */
export interface Extras {
  sector?: string;
  country?: string;
  subtype?: string;
}
/** Looked-up values, keyed "Asset Class:TICKER" (see `lotKey`). */
export type ExtrasMap = Record<string, Extras>;

export const lotKey = (assetClass: string, ticker: string) => `${assetClass}:${ticker}`;

type Row = Pick<HoldingInput, "ticker" | "name" | "assetClass" | "sector" | "country">;

/** Equity rows missing a sector or a country: the market data provider is asked about these (upper-case, no repeats). */
export function marketLookupTickers(rows: Row[]): string[] {
  return [...new Set(rows.filter((r) => r.assetClass === "Equities" && (!r.sector || !r.country)).map((r) => r.ticker.toUpperCase()))];
}

/**
 * What the market data answers add: a stock's sector and headquarters country, "Diversified" for an ETF / fund.
 * `profiles` only has tickers the provider answered for (null = answered, no data).
 */
export function marketExtras(rows: Row[], profiles: Record<string, MarketProfile | null>): ExtrasMap {
  const out: ExtrasMap = {};
  for (const r of rows) {
    if (r.assetClass !== "Equities") continue;
    const profile = profiles[r.ticker.toUpperCase()];
    if (!profile) continue;
    const found: Extras = {};
    const sector = r.sector ? null : equitySector(profile);
    if (sector) found.sector = sector;
    const isFund = (r.sector ?? sector) === DIVERSIFIED;
    if (!r.country && profile.country && !isFund) found.country = profile.country;
    if (Object.keys(found).length > 0) out[lotKey(r.assetClass, r.ticker)] = found;
  }
  return out;
}

/** Equity rows that still have no sector after the market data answered: these are sent to Claude. */
export function sectorsForClaude(rows: Row[], extras: ExtrasMap): { ticker: string; name: string }[] {
  const seen = new Set<string>();
  const out: { ticker: string; name: string }[] = [];
  for (const r of rows) {
    const t = r.ticker.toUpperCase();
    if (r.assetClass !== "Equities" || r.sector || extras[lotKey(r.assetClass, r.ticker)]?.sector || seen.has(t)) continue;
    seen.add(t);
    out.push({ ticker: t, name: r.name });
  }
  return out;
}

/** Claude's answer if it is one of the app's sectors (or "Diversified"), otherwise nothing. */
export const checkSector = (value: string): string | null => ((SECTOR_OPTIONS as readonly string[]).includes(value) ? value : null);

/** Add Claude's sectors (keyed by upper-case ticker) to the looked-up values for Equities rows. */
export function addClaudeSectors(rows: Row[], extras: ExtrasMap, found: Record<string, string>): ExtrasMap {
  const out: ExtrasMap = { ...extras };
  for (const r of rows) {
    const sector = found[r.ticker.toUpperCase()];
    if (r.assetClass !== "Equities" || r.sector || !sector) continue;
    const key = lotKey(r.assetClass, r.ticker);
    out[key] = { ...out[key], sector: out[key]?.sector ?? sector };
  }
  return out;
}

/** The row as it will be saved: looked-up values fill blanks only. */
export function withExtras(h: HoldingInput, extra: Extras | undefined): HoldingInput {
  if (!extra) return h;
  return {
    ...h,
    sector: h.sector ?? extra.sector ?? null,
    country: h.country ?? extra.country ?? null,
    subtype: h.subtype ?? extra.subtype ?? null,
  };
}

/** How many rows would still be blank on something that applies to them (equities: sector; bonds / alternatives: maturity / type). */
export function stillBlank(rows: HoldingInput[], extras: ExtrasMap): number {
  return rows.filter((h) => {
    const x = extras[lotKey(h.assetClass, h.ticker)];
    return h.assetClass === "Equities" ? !(h.sector ?? x?.sector) : !(h.subtype ?? x?.subtype);
  }).length;
}
