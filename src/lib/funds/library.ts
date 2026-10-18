// Pure helpers for the fund library: no database, no network.

import type { SubtypeClass } from "@/config/subtypes";

export interface FundItem {
  ticker: string;
  name: string;
  assetClass: SubtypeClass;
}

/** One saved fund. */
export interface FundRecord {
  ticker: string;
  name: string;
  assetClass: string;
  subtype: string;
  durationYears: number | null;
}

export const fundKey = (assetClass: string, ticker: string) => `${assetClass}:${ticker.toUpperCase()}`;

/**
 * Split holdings into those the library already knows and those it doesn't.
 * `known` is keyed "Asset Class:TICKER". A library fund only counts when its asset class matches the holding's.
 */
export function splitKnown(items: FundItem[], library: FundRecord[]): { known: Record<string, string>; unknown: FundItem[] } {
  const byTicker = new Map(library.map((f) => [f.ticker.toUpperCase(), f]));
  const known: Record<string, string> = {};
  const unknown: FundItem[] = [];
  for (const item of items) {
    const hit = byTicker.get(item.ticker.toUpperCase());
    if (hit && hit.assetClass === item.assetClass) known[fundKey(item.assetClass, item.ticker)] = hit.subtype;
    else unknown.push(item);
  }
  return { known, unknown };
}
