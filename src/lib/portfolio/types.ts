export const ASSET_CLASSES = ["Equities", "Fixed Income", "Alternatives", "Cash"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Asset classes that hold positions (cash is a single amount, not a position). */
export const HOLDING_CLASSES = ["Equities", "Fixed Income", "Alternatives"] as const;
export type HoldingClass = (typeof HOLDING_CLASSES)[number];

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
}
