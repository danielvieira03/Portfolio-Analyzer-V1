// Finds the maturity / type of holdings: the fund library first (free), Claude only for funds the
// library doesn't know, and whatever Claude finds is saved back to the library.
// The library and Claude are passed in, so this is tested with fakes (no database, no API).

import type { AiUsage } from "@/lib/ai/claude";
import { fundKey, splitKnown, type FundItem, type FundRecord } from "./library";

export interface ClaudeLookup {
  found: Record<string, string>;
  /** Duration in years per "Asset Class:TICKER", only where Claude read one. */
  durations: Record<string, number>;
  usage: AiUsage;
  searches: number;
}

export interface ResolveDeps {
  getLibrary: (tickers: string[]) => Promise<FundRecord[]>;
  lookup: (items: FundItem[]) => Promise<ClaudeLookup>;
  save: (funds: FundRecord[]) => Promise<void>;
}

export interface Resolved {
  found: Record<string, string>;
  fromLibrary: number;
  searched: number;
  usage: AiUsage;
  searches: number;
}

/** A bond fund Claude couldn't pin down ("Not specified") is not saved, so it is tried again later. */
const worthSaving = (assetClass: string, subtype: string) => !(assetClass === "Fixed Income" && subtype === "Not specified");

export async function resolveSubtypes(items: FundItem[], deps: ResolveDeps): Promise<Resolved> {
  const library = await deps.getLibrary(items.map((i) => i.ticker.toUpperCase()));
  const { known, unknown } = splitKnown(items, library);
  const out: Resolved = { found: { ...known }, fromLibrary: Object.keys(known).length, searched: unknown.length, usage: { inputTokens: 0, outputTokens: 0 }, searches: 0 };
  if (unknown.length === 0) return out;

  const claude = await deps.lookup(unknown);
  Object.assign(out.found, claude.found);
  out.usage = claude.usage;
  out.searches = claude.searches;

  const toSave: FundRecord[] = [];
  for (const item of unknown) {
    const key = fundKey(item.assetClass, item.ticker);
    const subtype = claude.found[key];
    if (!subtype || !worthSaving(item.assetClass, subtype)) continue;
    toSave.push({
      ticker: item.ticker.toUpperCase(),
      name: item.name,
      assetClass: item.assetClass,
      subtype,
      durationYears: item.assetClass === "Fixed Income" ? (claude.durations[key] ?? null) : null,
    });
  }
  if (toSave.length > 0) await deps.save(toSave);
  return out;
}
