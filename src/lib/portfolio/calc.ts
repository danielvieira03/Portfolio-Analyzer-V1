// All portfolio math lives here as plain functions (no database, no UI).
// Weights and percentages are fractions: 0.25 means 25%.

import { DIVERSIFIED, SECTORS, type Sector } from "./sectors";
import type { AssetClass, Position } from "./types";
import { ASSET_CLASSES } from "./types";

/** Current market value of one position. */
export const marketValue = (p: Position) => p.shares * p.currentPrice;

/** What was paid for one position. */
export const costValue = (p: Position) => p.shares * p.costBasisPerShare;

/** Unrealized gain/loss of one position in dollars. */
export const gainLoss = (p: Position) => marketValue(p) - costValue(p);

/** Unrealized gain/loss as a fraction of cost (0 when cost is 0). */
export const gainLossPct = (p: Position) => {
  const cost = costValue(p);
  return cost === 0 ? 0 : gainLoss(p) / cost;
};

/** part / total as a fraction; 0 when total is 0. */
export const weight = (part: number, total: number) => (total === 0 ? 0 : part / total);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface PortfolioSummary {
  totalValue: number;
  /** Cost of all positions plus cash (cash counts at face value). */
  totalCost: number;
  gainLoss: number;
  gainLossPct: number;
  cash: number;
}

/** Headline numbers. Value and cost both include cash, so value - cost = gain/loss. */
export function summarize(positions: Position[], cash: number): PortfolioSummary {
  const totalValue = sum(positions.map(marketValue)) + cash;
  const totalCost = sum(positions.map(costValue)) + cash;
  const gl = totalValue - totalCost;
  return {
    totalValue,
    totalCost,
    gainLoss: gl,
    gainLossPct: totalCost === 0 ? 0 : gl / totalCost,
    cash,
  };
}

export interface AllocationSlice {
  assetClass: AssetClass;
  value: number;
  weight: number;
}

/** Value and weight per asset class (cash included); empty classes are left out. */
export function allocationByClass(positions: Position[], cash: number): AllocationSlice[] {
  const total = sum(positions.map(marketValue)) + cash;
  return ASSET_CLASSES.map((assetClass) => {
    const value =
      assetClass === "Cash"
        ? cash
        : sum(positions.filter((p) => p.assetClass === assetClass).map(marketValue));
    return { assetClass, value, weight: weight(value, total) };
  }).filter((s) => s.value > 0);
}

export interface SectorComparison {
  sector: Sector;
  portfolio: number; // fraction of sector-tagged stocks
  benchmark: number; // fraction
  /** portfolio - benchmark; positive = overweight. */
  difference: number;
}

/**
 * Equity sector weights vs a benchmark. Only equities with a real sector count
 * (broad funds tagged "Diversified" are skipped), and weights are shares of that
 * sector-tagged total. `benchmarkPercent` is in percent (33.9 = 33.9%).
 */
export function compareSectors(
  positions: Position[],
  benchmarkPercent: Record<Sector, number>,
): SectorComparison[] {
  const tagged = positions.filter(
    (p) => p.assetClass === "Equities" && p.sector && p.sector !== DIVERSIFIED,
  );
  const total = sum(tagged.map(marketValue));
  return SECTORS.map((sector) => {
    const value = sum(tagged.filter((p) => p.sector === sector).map(marketValue));
    const portfolio = weight(value, total);
    const benchmark = benchmarkPercent[sector] / 100;
    return { sector, portfolio, benchmark, difference: portfolio - benchmark };
  });
}

export interface RankedHolding {
  position: Position;
  value: number;
  /** Fraction of the whole portfolio (cash included). */
  weight: number;
}

/** The n largest positions by market value, with their share of the portfolio. */
export function topHoldings(positions: Position[], cash: number, n = 5): RankedHolding[] {
  const total = sum(positions.map(marketValue)) + cash;
  return positions
    .map((position) => ({ position, value: marketValue(position), weight: weight(marketValue(position), total) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Total market value of a group of positions. */
export const totalValue = (positions: Position[]) => sum(positions.map(marketValue));

/** The editable fields of a position (everything except its id and class). */
export interface Lot {
  name: string;
  sector: string | null;
  subtype: string | null;
  shares: number;
  costBasisPerShare: number;
  currentPrice: number;
  priceAsOf: Date;
}

/**
 * Combine a new purchase into an existing position of the same ticker.
 * Shares add up, cost per share becomes the share-weighted average, and the
 * price/date come from the newer entry. Name and sector keep the existing
 * values unless those are blank.
 */
export function mergePositions(existing: Lot, incoming: Lot): Lot {
  const shares = existing.shares + incoming.shares;
  const totalCost = existing.shares * existing.costBasisPerShare + incoming.shares * incoming.costBasisPerShare;
  return {
    name: existing.name || incoming.name,
    sector: existing.sector ?? incoming.sector,
    subtype: existing.subtype ?? incoming.subtype,
    shares,
    costBasisPerShare: shares === 0 ? 0 : totalCost / shares,
    currentPrice: incoming.currentPrice,
    priceAsOf: incoming.priceAsOf,
  };
}
