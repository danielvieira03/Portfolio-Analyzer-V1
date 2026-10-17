import type { SectorComparison } from "./calc";
import type { Sector } from "./sectors";

export type InsightKind = "over" | "under" | "none" | "inline";

export interface SectorInsight {
  sector: Sector;
  kind: InsightKind;
  /** Portfolio minus S&P 500, in percentage points (positive = overweight). */
  diffPp: number;
  portfolioPct: number;
  benchmarkPct: number;
}

/** Gaps smaller than this (in percentage points) read as "in line" — they round to 0.0 on screen. */
export const IN_LINE_PP = 0.05;

const KIND_ORDER: InsightKind[] = ["over", "under", "none", "inline"];

/**
 * Turn the sector comparison into plain-English categories: overweight, underweight (you hold some,
 * but less than the S&P 500), no holdings, or in line. Ordered by category, then by size of the gap
 * (for "no holdings", by the S&P 500 weight you are missing).
 */
export function sectorInsights(rows: SectorComparison[]): SectorInsight[] {
  const insights = rows.map<SectorInsight>((r) => {
    const diffPp = r.difference * 100;
    const portfolioPct = r.portfolio * 100;
    const benchmarkPct = r.benchmark * 100;
    let kind: InsightKind;
    if (r.portfolio === 0 && r.benchmark > 0) kind = "none";
    else if (Math.abs(diffPp) < IN_LINE_PP) kind = "inline";
    else kind = diffPp > 0 ? "over" : "under";
    return { sector: r.sector, kind, diffPp, portfolioPct, benchmarkPct };
  });
  return insights.sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (a.kind === "none") return b.benchmarkPct - a.benchmarkPct;
    return Math.abs(b.diffPp) - Math.abs(a.diffPp);
  });
}
