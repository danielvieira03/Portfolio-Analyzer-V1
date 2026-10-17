import { DonutPanel } from "@/components/dashboard/donut-panel";
import type { SubtypeAllocation } from "@/lib/portfolio/subtype-allocation";

const MATURITY_COLORS: Record<string, string> = {
  "Short-term": "var(--chart-4)",
  "Medium-term": "var(--chart-2)",
  "Long-term": "var(--chart-5)",
  "Not specified": "var(--chart-3)",
};

const TYPE_COLORS: Record<string, string> = {
  Commodities: "var(--chart-1)",
  REITs: "var(--chart-2)",
  Crypto: "var(--chart-5)",
  Infrastructure: "var(--chart-8)",
  Other: "var(--chart-3)",
};

const toSlices = (allocation: SubtypeAllocation, colors: Record<string, string>) =>
  allocation.slices.map((s) => ({ id: s.label, label: s.label, value: s.value, weight: s.weight, color: colors[s.label] ?? "var(--chart-6)" }));

export function FixedIncomeDonut({ allocation }: { allocation: SubtypeAllocation }) {
  return (
    <DonutPanel
      title="Fixed Income by Maturity"
      slices={toSlices(allocation, MATURITY_COLORS)}
      centreLabel="Fixed Income"
      centreValue={allocation.total}
      columnLabel="Maturity"
      empty="No fixed income yet."
    />
  );
}

export function AlternativesDonut({ allocation }: { allocation: SubtypeAllocation }) {
  return (
    <DonutPanel
      title="Alternatives by Type"
      slices={toSlices(allocation, TYPE_COLORS)}
      centreLabel="Alternatives"
      centreValue={allocation.total}
      columnLabel="Type"
      empty="No alternatives yet."
    />
  );
}
