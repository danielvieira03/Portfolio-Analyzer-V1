"use client";

import { AllocationDonut } from "@/components/dashboard/allocation-donut";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SectorDonut } from "@/components/dashboard/sector-donut";
import { StatCards } from "@/components/dashboard/stat-cards";
import { AlternativesDonut, FixedIncomeDonut } from "@/components/dashboard/subtype-donuts";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { toExistingLots } from "@/components/holdings/existing-lots";
import { ImportDialog } from "@/components/holdings/import-dialog";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { LoadingPage } from "@/components/shared/loading-page";
import { PageHeader } from "@/components/shared/page-header";
import { allocationByClass, summarize, topHoldings } from "@/lib/portfolio/calc";
import { equitySectorAllocation } from "@/lib/portfolio/sector-allocation";
import { subtypeAllocation } from "@/lib/portfolio/subtype-allocation";

export function DashboardView() {
  const state = usePortfolio();
  if (!state) return <LoadingPage title="Dashboard" subtitle="Portfolio overview" />;
  const { holdings: positions, cash, isDemoData } = state.doc;

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="Portfolio overview"
      actions={
        <>
          {isDemoData && <DemoBadge />}
          <ImportDialog existing={toExistingLots(positions)} />
        </>
      }
    />
  );

  if (positions.length === 0) {
    return (
      <>
        {header}
        <EmptyState />
      </>
    );
  }

  const summary = summarize(positions, cash);

  return (
    <div className="space-y-3">
      {header}
      <StatCards summary={summary} />
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="min-w-0">
          <AllocationDonut slices={allocationByClass(positions, cash)} totalValue={summary.totalValue} />
        </div>
        <div className="min-w-0">
          <SectorDonut allocation={equitySectorAllocation(positions)} />
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="min-w-0">
          <FixedIncomeDonut allocation={subtypeAllocation(positions, "Fixed Income")} />
        </div>
        <div className="min-w-0">
          <AlternativesDonut allocation={subtypeAllocation(positions, "Alternatives", true)} />
        </div>
      </div>
      <TopHoldings holdings={topHoldings(positions, cash, 5)} />
    </div>
  );
}
