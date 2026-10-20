"use client";

import { useState } from "react";
import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { INCOME_TOP_LIST } from "@/config/income";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { CategoryIncome } from "@/lib/portfolio/income";

const EMPTY: Record<string, string> = {
  Equities: "None of your stocks or equity ETFs pays income yet.",
  "Fixed Income": "None of your bond funds pays income yet.",
  Alternatives: "None of your alternatives pays income (gold and crypto funds don't).",
};

/** One category: its expected income and yield, and the holdings that pay it (top 5, the rest behind "Show all"). */
export function IncomeSection({ data }: { data: CategoryIncome }) {
  const [all, setAll] = useState(false);
  const { category, income, yield: categoryYield, shareOfPortfolioYield, contributors, unavailable } = data;
  const shown = all ? contributors : contributors.slice(0, INCOME_TOP_LIST);
  const hidden = contributors.length - INCOME_TOP_LIST;

  return (
    <Panel title={category} className="h-full">
      <p className="text-2xl font-semibold leading-none">
        <Num className="text-primary">{formatCurrency(income.expected)}</Num>
        <span className="ml-2 text-[12px] font-normal text-muted-foreground">expected per year</span>
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Low <Num className="text-foreground">{formatCurrency(income.low)}</Num> · High <Num className="text-foreground">{formatCurrency(income.high)}</Num>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <dt className="label-caps">Yield</dt>
          <dd className="mt-1 text-base font-semibold">
            <Num>{categoryYield === null ? "—" : formatPercent(categoryYield, 2)}</Num>
          </dd>
          <p className="text-[11px] text-muted-foreground">of the whole category</p>
        </div>
        <div>
          <dt className="label-caps">Share of portfolio yield</dt>
          <dd className="mt-1 text-base font-semibold">
            <Num>{formatPercent(shareOfPortfolioYield, 2)}</Num>
          </dd>
          <p className="text-[11px] text-muted-foreground">of total portfolio value</p>
        </div>
      </dl>

      {contributors.length === 0 ? (
        <p className="mt-4 border-t pt-4 text-muted-foreground">{EMPTY[category]}</p>
      ) : (
        <div className="mt-4 overflow-x-auto border-t pt-2">
          <table className="w-full min-w-[300px] text-[12px]">
            <thead>
              <tr className="label-caps border-b text-right">
                <th className="py-1.5 pr-2 text-left font-medium">Holding</th>
                <th className="px-1.5 py-1.5 font-medium">Annual income</th>
                <th className="px-1.5 py-1.5 font-medium">Yield</th>
                <th className="py-1.5 pl-1.5 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.ticker} className="border-b border-border/50 last:border-0">
                  <td className="max-w-36 py-2 pr-2">
                    <div className="font-medium text-primary">{c.ticker}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{c.name}</div>
                  </td>
                  <td className="num px-1.5 py-2 text-right">{formatCurrency(c.annual)}</td>
                  <td className="num px-1.5 py-2 text-right">{formatPercent(c.yield, 2)}</td>
                  <td className="num py-2 pl-1.5 text-right">{formatPercent(c.share, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hidden > 0 && (
            <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all (${contributors.length})`}
            </Button>
          )}
        </div>
      )}

      {unavailable.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">Income not available yet for {unavailable.map((u) => u.ticker).join(", ")}.</p>
      )}
    </Panel>
  );
}
