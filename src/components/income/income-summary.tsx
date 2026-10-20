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
      {note && <p className="mt-2 text-[12px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/** The top of the Income tab: total expected annual income and its range, the monthly average, the portfolio yield, and the Sankey. */
export function IncomeSummary({ income }: { income: PortfolioIncome }) {
  const { total, monthly, yield: portfolioYield, contributingCount, holdingCount, unavailable } = income;
  const flow = incomeFlow(income);

  return (
    <Panel title="Expected Annual Income">
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat
          label="Total expected annual income"
          note={
            <>
              Low <Num className="text-foreground">{formatCurrency(total.low)}</Num> · High <Num className="text-foreground">{formatCurrency(total.high)}</Num>
            </>
          }
        >
          <Num className="text-primary">{formatCurrency(total.expected)}</Num>
        </Stat>
        <Stat label="Average monthly income" note="The same each month: annual income divided by 12">
          <Num>{formatCurrency(monthly)}</Num>
        </Stat>
        <Stat label="Portfolio yield" note="Annual income divided by total portfolio value">
          <Num>{portfolioYield === null ? "—" : formatPercent(portfolioYield, 2)}</Num>
        </Stat>
      </div>

      <p className="mt-4 text-[13px] text-muted-foreground">
        <Num className="text-foreground">{contributingCount}</Num> out of <Num className="text-foreground">{holdingCount}</Num> holdings contribute to income
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
        {flow.nodes.length > 0 && <p>The diagram shows each category&rsquo;s top 3 income holdings; the totals above and the sections below include every holding that pays income.</p>}
        <p>Cash interest is not included.</p>
        <p>
          An estimate, before tax and assuming no reinvestment, based on each holding&rsquo;s dividends per share over roughly the last year. One-time special
          dividends can&rsquo;t always be told apart from regular ones.
        </p>
        <p>
          Range accounts for risks or upsides to income earned, such as differences between expected and current yields, dividend changes, and bond fund
          performance.
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
