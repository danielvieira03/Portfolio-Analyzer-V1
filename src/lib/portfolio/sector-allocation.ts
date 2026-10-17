import { marketValue } from "./calc";
import { DIVERSIFIED } from "./sectors";
import type { Position } from "./types";

/** Label for individual stocks that have no sector filled in. */
export const NO_SECTOR = "No sector";

export interface SectorMember {
  label: string;
  value: number;
  /** Fraction of total equities. */
  weight: number;
}

export interface SectorSlice extends SectorMember {
  kind: "sector" | "diversified" | "other";
  /** For "other": the sectors grouped into it, largest first. */
  members?: SectorMember[];
}

export interface SectorAllocation {
  /** Total market value of all equities (broad funds included). */
  total: number;
  slices: SectorSlice[];
}

/**
 * Where the equities sit by sector, as shares of total equities. The `topN` biggest sectors get
 * their own slice, broad equity funds ("Diversified") always get theirs, and any remaining
 * sectors are grouped into one "Other" slice that lists them as `members`. Empty if no equities.
 */
export function equitySectorAllocation(positions: Position[], topN = 7): SectorAllocation {
  const byLabel = new Map<string, number>();
  for (const p of positions) {
    if (p.assetClass !== "Equities") continue;
    const label = !p.sector ? NO_SECTOR : p.sector;
    byLabel.set(label, (byLabel.get(label) ?? 0) + marketValue(p));
  }

  const entries = [...byLabel.entries()].filter(([, value]) => value > 0);
  const total = entries.reduce((t, [, value]) => t + value, 0);
  if (total === 0) return { total: 0, slices: [] };

  const toMember = ([label, value]: [string, number]): SectorMember => ({ label, value, weight: value / total });
  const bySize = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

  const sectors = entries.filter(([label]) => label !== DIVERSIFIED).sort(bySize);
  const diversified = entries.find(([label]) => label === DIVERSIFIED);
  const top = sectors.slice(0, topN);
  const rest = sectors.slice(topN);

  const slices: SectorSlice[] = top.map((e) => ({ ...toMember(e), kind: "sector" }));
  if (diversified) slices.push({ ...toMember(diversified), kind: "diversified" });
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
  return { total, slices };
}
