import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { formatPercent } from "@/lib/format";
import type { Contributor } from "@/lib/portfolio/duration";

const years = (v: number) => v.toFixed(1);

/** The bond funds that add the most to the average duration: each fund's share of fixed income, its own duration and what it adds. */
export function DurationContributors({ rows }: { rows: Contributor[] }) {
  return (
    <Panel title="Duration Contributors" className="h-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[330px] text-[12px]">
          <thead>
            <tr className="label-caps border-b text-right">
              <th className="py-1.5 pr-2 text-left font-medium">Fund</th>
              <th className="px-1.5 py-1.5 font-medium sm:px-2">Share of fixed income</th>
              <th className="px-1.5 py-1.5 font-medium sm:px-2">Duration</th>
              <th className="px-1.5 py-1.5 font-medium sm:px-2">Adds</th>
              <th className="py-1.5 pl-2 font-medium">Share of duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="border-b border-border/50 last:border-0">
                <td className="max-w-40 py-2 pr-2">
                  <div className="font-medium text-primary">{r.ticker}</div>
                  <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{r.name}</div>
                </td>
                <td className="num px-1.5 py-2 text-right sm:px-2">{formatPercent(r.weight, 1)}</td>
                <td className="num px-1.5 py-2 text-right sm:px-2">{years(r.years)} yrs</td>
                <td className="num px-1.5 py-2 text-right sm:px-2">{years(r.contribution)} yrs</td>
                <td className="py-2 pl-2 text-right">
                  <Num>{formatPercent(r.shareOfDuration, 1)}</Num>
                  <div className="ml-auto mt-1 h-1 w-full min-w-16 rounded-full bg-muted" aria-hidden>
                    <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.min(100, r.shareOfDuration * 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
