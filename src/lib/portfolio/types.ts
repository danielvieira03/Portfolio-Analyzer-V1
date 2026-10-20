export const ASSET_CLASSES = ["Equities", "Fixed Income", "Alternatives", "Cash"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Asset classes that hold positions (cash is a single amount, not a position). */
export const HOLDING_CLASSES = ["Equities", "Fixed Income", "Alternatives"] as const;
export type HoldingClass = (typeof HOLDING_CLASSES)[number];

/**
 * What a fund (ETF) holds, saved in the visitor's browser per ticker. Weights are fractions (0.3 = 30%),
 * already translated to the app's sector names and ISO country codes; anything the app can't name is left
 * out (so it counts as "Unclassified"). status "none" = the provider had nothing for this fund.
 */
export interface EtfBreakdown {
  sectors: { name: string; weight: number }[];
  countries: { code: string; weight: number }[];
  /** ISO timestamp of the last lookup (used to refresh about weekly). */
  updatedAt: string;
  status: "ok" | "none";
  /** Which version of the name translation made this (`BREAKDOWN_MAPPING_VERSION`). Missing = the first version. */
  mapping?: number;
  /** "claude" when Claude read these weights from a fund page because the market data had none (the market data's own replace them later). */
  source?: "claude";
}

/**
 * A bond fund's duration (years) as found for this visitor by a lookup, saved in the browser per ticker. `years` null = the
 * lookup found none (tried again only after a week). The built-in fund library's durations are not saved here.
 */
export interface DurationRecord {
  years: number | null;
  /** ISO time of the lookup. */
  checkedAt: string;
}

/** A position as the math functions see it — plain numbers, no database types. */
export interface Position {
  id: string;
  ticker: string;
  name: string;
  assetClass: HoldingClass;
  sector: string | null;
  /** Fixed Income: maturity bucket; Alternatives: type. Null = not set yet; empty for equities. */
  subtype: string | null;
  shares: number;
  costBasisPerShare: number;
  currentPrice: number;
  /** True when the market data API had no price for this ticker at the last refresh (the manual price is kept). */
  noLivePrice?: boolean;
  /** Individual stocks only: the company's headquarters country (ISO two-letter code), from market data. Null = not known. */
  country?: string | null;
}
