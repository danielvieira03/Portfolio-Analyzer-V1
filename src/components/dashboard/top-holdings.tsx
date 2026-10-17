import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { RankedHolding } from "@/lib/portfolio/calc";

export function TopHoldings({ holdings }: { holdings: RankedHolding[] }) {
  const maxWeight = Math.max(...holdings.map((h) => h.weight), 0.0001);
  return (
    <Panel title="Top 5 Holdings" className="h-full">
      <ol className="divide-y divide-border/60">
        {holdings.map((h, i) => (
          <li key={h.position.id} className="py-2 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="num w-4 text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{h.position.name}</p>
                <p className="num !text-left text-[11px] text-primary">{h.position.ticker}</p>
              </div>
              <div className="text-right">
                <Num className="block">{formatCurrency(h.value)}</Num>
                <Num className="block text-[11px] text-muted-foreground">
                  {formatPercent(h.weight, 1)} of portfolio
                </Num>
              </div>
            </div>
            <div className="mt-1.5 ml-7 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(h.weight / maxWeight) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
