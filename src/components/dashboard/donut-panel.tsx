"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChartTooltipBox, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  /** Fraction of the whole donut. */
  weight: number;
  color: string;
  /** For a grouped slice (e.g. "Other"): what it is made of, shown in the hover card. */
  members?: { label: string; value: number; weight: number }[];
}

/**
 * A donut with a total in the middle, a legend table beside it and a hover card below it.
 * The hover card sits below the donut, so it can never cover the ring or the total.
 */
export function DonutPanel({
  title,
  slices,
  centreLabel,
  centreValue,
  columnLabel,
  reserveClass = "pb-20",
  empty,
  footnote,
}: {
  title: string;
  slices: DonutSlice[];
  centreLabel: string;
  centreValue: number;
  /** Header of the first legend column, e.g. "Class". */
  columnLabel: string;
  /** Bottom padding that reserves room for the tallest hover card. */
  reserveClass?: string;
  /** Message shown instead of the chart when there are no slices. */
  empty: string;
  /** Small grey line under the chart and table. */
  footnote?: string;
}) {
  const [hovered, setHovered] = useState<DonutSlice | null>(null);

  if (slices.length === 0) {
    return (
      <Panel title={title} className="h-full">
        <p className="py-10 text-center text-muted-foreground">{empty}</p>
      </Panel>
    );
  }

  return (
    <Panel title={title} className="h-full">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* Bottom padding reserves room for the hover card so the layout never jumps. */}
        <div className={cn("relative shrink-0", reserveClass)}>
          <div className="relative size-48">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 192, height: 192 }}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={1.5}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseEnter={(_, i) => setHovered(slices[i] ?? null)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {slices.map((s) => (
                    <Cell key={s.id} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="label-caps">{centreLabel}</span>
              <Num className="text-base font-semibold">{formatCurrency(centreValue)}</Num>
            </div>
          </div>
          {hovered && (
            <div
              className={cn(
                "pointer-events-none absolute top-[calc(12rem+0.5rem)] z-50",
                // A card that lists members is wider: on wide screens it starts at the donut's left edge.
                hovered.members ? "left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 [&>div>div]:w-52" : "left-1/2 -translate-x-1/2",
              )}
            >
              {/* Fades in while drifting down a few pixels; skipped for people who prefer less motion. */}
              <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                {hovered.members ? (
                  <ChartTooltipBox title={`${hovered.label} (${hovered.members.length} ${hovered.members.length === 1 ? "sector" : "sectors"})`}>
                    {hovered.members.map((m) => (
                      <ChartTooltipRow key={m.label} label={m.label} value={`${formatCurrency(m.value)} · ${formatPercent(m.weight, 1)}`} />
                    ))}
                  </ChartTooltipBox>
                ) : (
                  <ChartTooltipBox title={hovered.label}>
                    <ChartTooltipRow color={hovered.color} label="Value" value={formatCurrency(hovered.value)} />
                    <ChartTooltipRow label="Weight" value={formatPercent(hovered.weight)} />
                  </ChartTooltipBox>
                )}
              </div>
            </div>
          )}
        </div>

        {/* At least as tall as the donut, so a short table lines up with it and a long one just grows. */}
        <div className="w-full sm:flex sm:min-h-48 sm:items-center">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="label-caps border-b">
                <th className="py-1.5 text-left font-medium">{columnLabel}</th>
                <th className="py-1.5 text-right font-medium">Value</th>
                <th className="py-1.5 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                      {s.label}
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
      {footnote && <p className="mt-1 text-[11px] text-muted-foreground">{footnote}</p>}
    </Panel>
  );
}
