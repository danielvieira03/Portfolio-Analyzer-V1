import { AllocationDonut } from "@/components/dashboard/allocation-donut";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { toExistingLots } from "@/components/holdings/existing-lots";
import { ImportDialog } from "@/components/holdings/import-dialog";
import { SectorDonut } from "@/components/dashboard/sector-donut";
import { StatCards } from "@/components/dashboard/stat-cards";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { PageHeader } from "@/components/shared/page-header";
import { getPortfolio } from "@/data/holdings.repo";
import {
  allocationByClass,
  summarize,
  topHoldings,
} from "@/lib/portfolio/calc";
import { equitySectorAllocation } from "@/lib/portfolio/sector-allocation";

// Always read the latest data from the database.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { positions, cash, isDemoData } = await getPortfolio();
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
          <AllocationDonut
            slices={allocationByClass(positions, cash)}
            totalValue={summary.totalValue}
          />
        </div>
        <div className="min-w-0">
          <SectorDonut allocation={equitySectorAllocation(positions)} />
        </div>
      </div>
      <TopHoldings holdings={topHoldings(positions, cash, 5)} />
    </div>
  );
}
