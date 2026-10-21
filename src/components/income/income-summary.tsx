import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { formatCurrency, formatPercent } from "@/lib/format";
import { incomeFlow, type PortfolioIncome } from "@/lib/portfolio/income";
import { IncomeSankey } from "./income-sankey";

function Stat({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <div className="mt-2 text-2xl font-semibold leading-none lg:text-3xl">{children}</div>
      {note && <div className="text-[12px] text-muted-foreground">{note}</div>}
    </div>
  );
}

/** A thin bar from the low to the high figure with a marker at the expected one (the range is always expected -10% / +10%, so the marker is centred). */
function RangeBar({ low, high }: { low: number; high: number }) {
  return (
    <div className="mt-3 max-w-xs" role="img" aria-label={`Range from ${formatCurrency(low)} to ${formatCurrency(high)}`}>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary/30" />
        <div className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-primary/60" />
        <div className="absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-primary/60" />
        <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <Num>{formatCurrency(low)}</Num>
        <Num>{formatCurrency(high)}</Num>
      </div>
    </div>
  );
}

/** The top of the Income tab: total expected annual income and its range, the monthly average, the portfolio yield, and the Sankey. */
export function IncomeSummary({ income }: { income: PortfolioIncome }) {
  const { total, monthly, yield: portfolioYield, payingShare, unavailable } = income;
  const flow = incomeFlow(income);

  return (
    <Panel title="Expected Annual Income">
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Expected annual income" note={<RangeBar low={total.low} high={total.high} />}>
          <Num className="text-primary">{formatCurrency(total.expected)}</Num>
        </Stat>
        <Stat label="Average monthly income">
          <Num>{formatCurrency(monthly)}</Num>
        </Stat>
        <Stat label="Portfolio yield">
          <Num>{portfolioYield === null ? "—" : formatPercent(portfolioYield, 2)}</Num>
        </Stat>
      </div>

      <p className="mt-4 text-[13px] text-muted-foreground">
        <Num className="text-foreground">{formatPercent(payingShare, 0)}</Num> of the portfolio contributes to income
      </p>

      <div className="mt-3 border-t pt-3">
        {flow.nodes.length > 0 ? (
          <IncomeSankey nodes={flow.nodes} links={flow.links} />
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            {unavailable.length > 0 ? "Income data for your holdings is still loading; it fills in with the next price refresh." : "None of your holdings pays income yet."}
          </p>
        )}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p>Cash interest is not included.</p>
        <p>
          An estimate, based on each holding&rsquo;s dividends per share over the last year. Past performance isn&rsquo;t an indicator of future results.
        </p>
        {unavailable.length > 0 && (
          <p>
            Income not available yet for {unavailable.map((u) => u.ticker).join(", ")}; it is left out until market data provides it (it never guesses).
          </p>
        )}
      </div>
    </Panel>
  );
}
