import type { Position } from "@/lib/portfolio/types";
import type { ExistingLot } from "./import-preview";

/** What the import dialog needs to know about current positions (to flag repeats and show averages). */
export const toExistingLots = (positions: Position[]): ExistingLot[] =>
  positions.map((p) => ({
    assetClass: p.assetClass,
    ticker: p.ticker,
    name: p.name,
    sector: p.sector,
    subtype: p.subtype,
    shares: p.shares,
    costBasisPerShare: p.costBasisPerShare,
  }));
