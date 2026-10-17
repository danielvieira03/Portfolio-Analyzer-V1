import { SUBTYPE_FALLBACK, SUBTYPE_OPTIONS, type SubtypeClass } from "@/config/subtypes";
import { marketValue } from "./calc";
import type { Position } from "./types";

export interface SubtypeSlice {
  label: string;
  value: number;
  /** Fraction of the asset class's total value. */
  weight: number;
}

export interface SubtypeAllocation {
  /** Total market value of the asset class. */
  total: number;
  slices: SubtypeSlice[];
}

/**
 * How one asset class splits by its maturity (Fixed Income) or type (Alternatives). Holdings with no
 * value yet count under the "unknown" label ("Not specified" / "Other"). Empty groups are left out.
 * Slices follow the order of the allowed values (so maturities read short to long), or by size when
 * `bySize` is set, with the "unknown" group always last.
 */
export function subtypeAllocation(positions: Position[], assetClass: SubtypeClass, bySize = false): SubtypeAllocation {
  const options = SUBTYPE_OPTIONS[assetClass] as readonly string[];
  const fallback = SUBTYPE_FALLBACK[assetClass];
  const totals = new Map<string, number>();
  for (const p of positions) {
    if (p.assetClass !== assetClass) continue;
    const label = p.subtype && options.includes(p.subtype) ? p.subtype : fallback;
    totals.set(label, (totals.get(label) ?? 0) + marketValue(p));
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return { total: 0, slices: [] };

  const slices = options
    .filter((label) => (totals.get(label) ?? 0) > 0)
    .map((label) => ({ label, value: totals.get(label)!, weight: totals.get(label)! / total }));
  if (bySize) {
    slices.sort((a, b) => {
      if (a.label === fallback) return 1;
      if (b.label === fallback) return -1;
      return b.value - a.value || a.label.localeCompare(b.label);
    });
  }
  return { total, slices };
}
