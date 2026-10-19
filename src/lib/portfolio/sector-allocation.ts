import { lookThroughExposure, UNCLASSIFIED } from "./exposure";
import type { EtfBreakdown, Position } from "./types";

export interface SectorMember {
  label: string;
  value: number;
  /** Fraction of the equities counted (including the unclassified part). */
  weight: number;
}

export interface SectorSlice extends SectorMember {
  kind: "sector" | "unclassified" | "other";
  /** For "other": the sectors grouped into it, largest first. */
  members?: SectorMember[];
}

export interface SectorAllocation {
  /** Total market value of all equities counted (stocks and equity ETFs). */
  total: number;
  slices: SectorSlice[];
  /** Equity ETFs with no usable breakdown (all of their value is unclassified). */
  fundsWithoutData: number;
  /** Oldest "last updated" among the fund breakdowns used (ISO), or null. */
  oldestBreakdown: string | null;
}

/**
 * Where the equities sit by sector, as shares of total equities, with equity ETFs split across their sectors
 * (via `lookThroughExposure`, the shared exposure function). The `topN` biggest sectors get their own slice,
 * whatever has no sector (an ETF's missing part, a stock with no sector yet) is "Unclassified", and any remaining
 * sectors are grouped into one "Other" slice that lists them as `members`. Empty if no equities.
 */
export function equitySectorAllocation(
  positions: Position[],
  breakdowns: Record<string, EtfBreakdown> = {},
  topN = 7,
): SectorAllocation {
  const { sector } = lookThroughExposure(positions, breakdowns);
  const meta = { fundsWithoutData: sector.fundsWithoutData, oldestBreakdown: sector.oldestBreakdown };
  if (sector.total === 0) return { total: 0, slices: [], ...meta };

  const toMember = (r: { label: string; value: number; weight: number }): SectorMember => ({ label: r.label, value: r.value, weight: r.weight });
  const top = sector.rows.slice(0, topN);
  const rest = sector.rows.slice(topN);

  const slices: SectorSlice[] = top.map((r) => ({ ...toMember(r), kind: "sector" }));
  if (sector.unclassified.value > 0) {
    slices.push({ label: UNCLASSIFIED, value: sector.unclassified.value, weight: sector.unclassified.weight, kind: "unclassified" });
  }
  if (rest.length > 0) {
    const members = rest.map(toMember);
    slices.push({
      label: "Other",
      value: members.reduce((t, m) => t + m.value, 0),
      weight: members.reduce((t, m) => t + m.weight, 0),
      kind: "other",
      members,
    });
  }
  return { total: sector.total, slices, ...meta };
}
