import { DonutPanel } from "@/components/dashboard/donut-panel";
import type { AllocationSlice } from "@/lib/portfolio/calc";
import type { AssetClass } from "@/lib/portfolio/types";

const CLASS_COLORS: Record<AssetClass, string> = {
  Equities: "var(--chart-1)",
  "Fixed Income": "var(--chart-2)",
  Alternatives: "var(--chart-4)",
  Cash: "var(--chart-3)",
};

export function AllocationDonut({
  slices,
  totalValue,
}: {
  slices: AllocationSlice[];
  totalValue: number;
}) {
  return (
    <DonutPanel
      title="Allocation by Asset Class"
      slices={slices.map((s) => ({
        id: s.assetClass,
        label: s.assetClass,
        value: s.value,
        weight: s.weight,
        color: CLASS_COLORS[s.assetClass],
      }))}
      centreLabel="Total"
      centreValue={totalValue}
      columnLabel="Class"
      empty="No holdings yet."
    />
  );
}
