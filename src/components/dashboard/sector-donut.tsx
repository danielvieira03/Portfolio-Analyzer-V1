import { DonutPanel, type DonutSlice } from "@/components/dashboard/donut-panel";
import type { SectorAllocation } from "@/lib/portfolio/sector-allocation";

// The biggest sectors take these colours in size order; broad funds and "Other" have their own.
const SECTOR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
];
const DIVERSIFIED_COLOR = "var(--chart-3)";
const OTHER_COLOR = "var(--chart-6)";

export function SectorDonut({ allocation }: { allocation: SectorAllocation }) {
  let nextSector = 0;
  const slices: DonutSlice[] = allocation.slices.map((s) => ({
    id: s.label,
    label: s.label,
    value: s.value,
    weight: s.weight,
    members: s.members,
    color: s.kind === "diversified" ? DIVERSIFIED_COLOR : s.kind === "other" ? OTHER_COLOR : SECTOR_COLORS[nextSector++ % SECTOR_COLORS.length],
  }));
  return (
    <DonutPanel
      title="Allocation by Equity Sector"
      slices={slices}
      centreLabel="Equities"
      centreValue={allocation.total}
      columnLabel="Sector"
      // Room for the "Other" card, which lists up to a handful of sectors.
      reserveClass="pb-44"
      empty="No equities yet."
    />
  );
}
