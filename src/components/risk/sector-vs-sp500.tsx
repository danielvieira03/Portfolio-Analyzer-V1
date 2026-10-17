"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { Panel } from "@/components/shared/panel";
import { formatDate } from "@/lib/format";
import type { SectorComparison } from "@/lib/portfolio/calc";

const PORTFOLIO_COLOR = "var(--chart-1)";
const BENCHMARK_COLOR = "var(--chart-3)";

interface Row extends SectorComparison {
  portfolioPct: number;
  benchmarkPct: number;
}

const pct = (v: number) => `${v.toFixed(1)}%`;
const signedPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export function SectorVsSp500({
  rows,
  asOf,
  hasSectorData,
}: {
  rows: SectorComparison[];
  asOf: string;
  hasSectorData: boolean;
}) {
  const data: Row[] = rows.map((r) => ({
    ...r,
    portfolioPct: r.portfolio * 100,
    benchmarkPct: r.benchmark * 100,
  }));
  const diffBySector = new Map(data.map((r) => [r.sector, r.difference * 100]));

  return (
    <Panel
      title="Equity Sectors vs S&P 500"
      className="h-full"
      action={<span className="label-caps">S&amp;P 500 as of {formatDate(asOf)}</span>}
    >
      {!hasSectorData ? (
        <p className="py-10 text-center text-muted-foreground">
          No individual stocks with a sector yet.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: PORTFOLIO_COLOR }} /> Portfolio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: BENCHMARK_COLOR }} /> S&amp;P 500
            </span>
            <span className="ml-auto">Right column: over / underweight vs S&amp;P</span>
          </div>
          <div className="h-[420px] xl:h-[530px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 420 }}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                barCategoryGap={8}
                barGap={2}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="sector"
                  width={150}
                  tick={{ fill: "var(--foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="diff"
                  orientation="right"
                  type="category"
                  dataKey="sector"
                  width={64}
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload }) => {
                    const d = diffBySector.get(payload.value) ?? 0;
                    return (
                      <text
                        x={(x as number) + 6}
                        y={y as number}
                        dy={4}
                        fontSize={11}
                        fontFamily="var(--font-geist-mono)"
                        fill={Math.abs(d) < 0.05 ? "var(--muted-foreground)" : d > 0 ? "var(--chart-1)" : "var(--chart-2)"}
                      >
                        {signedPct(d)}
                      </text>
                    );
                  }}
                />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                  content={({ active, payload }) => {
                    const r = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                    if (!r) return null;
                    const d = r.difference * 100;
                    return (
                      <ChartTooltipBox title={r.sector}>
                        <ChartTooltipRow color={PORTFOLIO_COLOR} label="Portfolio" value={pct(r.portfolioPct)} />
                        <ChartTooltipRow color={BENCHMARK_COLOR} label="S&P 500" value={pct(r.benchmarkPct)} />
                        <ChartTooltipRow
                          label={d >= 0 ? "Overweight" : "Underweight"}
                          value={signedPct(d)}
                        />
                      </ChartTooltipBox>
                    );
                  }}
                />
                <Bar dataKey="portfolioPct" fill={PORTFOLIO_COLOR} radius={[0, 2, 2, 0]} barSize={9} isAnimationActive={false} />
                <Bar dataKey="benchmarkPct" fill={BENCHMARK_COLOR} radius={[0, 2, 2, 0]} barSize={9} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Individual stocks only — broad funds are excluded. Portfolio weights are shares of
            sector-tagged equities.
          </p>
        </>
      )}
    </Panel>
  );
}
