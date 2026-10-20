"use client";

import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { IncomeSection } from "@/components/income/income-section";
import { IncomeSummary } from "@/components/income/income-summary";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { LoadingPage } from "@/components/shared/loading-page";
import { PageHeader } from "@/components/shared/page-header";
import { portfolioIncome } from "@/lib/portfolio/income";

export function IncomeView() {
  const state = usePortfolio();
  if (!state) return <LoadingPage title="Income" subtitle="Estimated annual income" />;
  const { holdings: positions, cash, isDemoData } = state.doc;
  const income = portfolioIncome(positions, cash);

  return (
    <div className="space-y-3">
      <PageHeader title="Income" subtitle="Estimated annual income" actions={isDemoData ? <DemoBadge /> : undefined} />
      {positions.length === 0 ? (
        <EmptyState title="No holdings yet" description="Upload your positions to see the income they are expected to pay." />
      ) : (
        <>
          <IncomeSummary income={income} />
          <div className="grid gap-3 xl:grid-cols-3">
            {income.categories.map((c) => (
              <div key={c.category} className="min-w-0">
                <IncomeSection data={c} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
