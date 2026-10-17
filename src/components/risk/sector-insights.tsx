import { Panel } from "@/components/shared/panel";
import { sectorInsights, type InsightKind, type SectorInsight } from "@/lib/portfolio/sector-insights";
import type { SectorComparison } from "@/lib/portfolio/calc";

const pct = (v: number) => `${v.toFixed(1)}%`;
const pp = (v: number) => `${Math.abs(v).toFixed(1)} pp`;

// Same colours as the chart's right-hand column: amber = over, blue = under, grey = none / in line.
const MARKER: Record<InsightKind, string> = {
  over: "var(--chart-1)",
  under: "var(--chart-2)",
  none: "var(--chart-3)",
  inline: "var(--chart-6)",
};

const GROUP_LABEL: Record<InsightKind, string> = {
  over: "Overweight",
  under: "Underweight",
  none: "No holdings",
  inline: "In line",
};

function Sentence({ i }: { i: SectorInsight }) {
  const sector = <strong className="font-semibold text-foreground">{i.sector}</strong>;
  switch (i.kind) {
    case "over":
      return <>Overweight in {sector} by <strong className="num font-semibold text-foreground">{pp(i.diffPp)}</strong></>;
    case "under":
      return <>Underweight in {sector} by <strong className="num font-semibold text-foreground">{pp(i.diffPp)}</strong></>;
    case "none":
      return <>No holdings in {sector}</>;
    case "inline":
      return <>In line on {sector}</>;
  }
}

function Detail({ i }: { i: SectorInsight }) {
  switch (i.kind) {
    case "over":
    case "under":
      return <>{pct(i.portfolioPct)} of your stocks vs {pct(i.benchmarkPct)} in the S&amp;P 500</>;
    case "none":
      return <>S&amp;P 500 weight {pct(i.benchmarkPct)}, so you’re underweight by {pp(i.diffPp)}</>;
    case "inline":
      return <>Same weight as the S&amp;P 500</>;
  }
}

export function SectorInsights({ rows }: { rows: SectorComparison[] }) {
  const insights = sectorInsights(rows);
  const groups = (["over", "under", "none", "inline"] as const)
    .map((kind) => ({ kind, items: insights.filter((i) => i.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <Panel title="Sector Over / Underweight" className="h-full">
      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.kind} aria-label={GROUP_LABEL[g.kind]}>
            <p className="label-caps mb-1">{GROUP_LABEL[g.kind]}</p>
            <ul className="divide-y divide-border/50">
              {g.items.map((i) => (
                <li key={i.sector} className="flex items-start gap-2.5 py-1.5">
                  <span className="mt-1 h-7 w-[3px] shrink-0 rounded-full" style={{ background: MARKER[i.kind] }} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-muted-foreground">
                      <Sentence i={i} />
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <Detail i={i} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Individual stocks only — broad funds are excluded. pp = percentage points.
      </p>
    </Panel>
  );
}
