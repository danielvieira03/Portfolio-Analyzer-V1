import { Num } from "@/components/shared/num";
import {
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format";
import type { PortfolioSummary } from "@/lib/portfolio/calc";

function Card({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel px-4 py-4">
      <p className="label-caps">{label}</p>
      <div className="mt-3 text-2xl font-semibold leading-none lg:text-3xl">{children}</div>
      <p className="mt-3 h-4 text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function StatCards({ summary }: { summary: PortfolioSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Total Portfolio Value" hint="Positions + cash">
        <Num className="text-primary">{formatCurrency(summary.totalValue)}</Num>
      </Card>
      <Card label="Total Cost Basis" hint="Positions + cash">
        <Num>{formatCurrency(summary.totalCost)}</Num>
      </Card>
      <Card label="Unrealized Gain / Loss" hint="Value minus cost basis">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Num value={summary.gainLoss} tone="auto">
            {formatSignedCurrency(summary.gainLoss)}
          </Num>
          <Num value={summary.gainLoss} tone="auto" className="text-base font-medium">
            {formatSignedPercent(summary.gainLossPct)}
          </Num>
        </div>
      </Card>
      <Card label="Cash" hint="Uninvested balance">
        <Num>{formatCurrency(summary.cash)}</Num>
      </Card>
    </div>
  );
}
