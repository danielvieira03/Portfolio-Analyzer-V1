"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChartTooltipBox, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { formatCurrency, formatPercent } from "@/lib/format";
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
  // The hover card sits below the donut, so it can never cover the ring or the total in the middle.
  const [hovered, setHovered] = useState<AllocationSlice | null>(null);
  return (
    <Panel title="Allocation by Asset Class" className="h-full">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* Bottom padding reserves room for the hover card so the layout never jumps. */}
        <div className="relative shrink-0 pb-20">
          <div className="relative size-48">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 192, height: 192 }}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="assetClass"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={1.5}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseEnter={(_, i) => setHovered(slices[i] ?? null)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {slices.map((s) => (
                    <Cell key={s.assetClass} fill={CLASS_COLORS[s.assetClass]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="label-caps">Total</span>
              <Num className="text-base font-semibold">{formatCurrency(totalValue)}</Num>
            </div>
          </div>
          {hovered && (
            <div className="pointer-events-none absolute left-1/2 top-[calc(12rem+0.5rem)] z-50 -translate-x-1/2">
              {/* Fades in while drifting down a few pixels; skipped for people who prefer less motion. */}
              <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                <ChartTooltipBox title={hovered.assetClass}>
                  <ChartTooltipRow color={CLASS_COLORS[hovered.assetClass]} label="Value" value={formatCurrency(hovered.value)} />
                  <ChartTooltipRow label="Weight" value={formatPercent(hovered.weight)} />
                </ChartTooltipBox>
              </div>
            </div>
          )}
        </div>

        {/* Same height as the donut, so the table lines up with it and not with the hover-card space below. */}
        <div className="w-full sm:flex sm:h-48 sm:items-center">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="label-caps border-b">
                <th className="py-1.5 text-left font-medium">Class</th>
                <th className="py-1.5 text-right font-medium">Value</th>
                <th className="py-1.5 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => (
                <tr key={s.assetClass} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-[2px]" style={{ background: CLASS_COLORS[s.assetClass] }} />
                      {s.assetClass}
                    </span>
                  </td>
                  <td className="py-1.5"><Num className="block">{formatCurrency(s.value)}</Num></td>
                  <td className="py-1.5"><Num className="block">{formatPercent(s.weight, 1)}</Num></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
