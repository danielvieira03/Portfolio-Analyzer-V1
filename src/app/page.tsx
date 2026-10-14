import { AllocationDonut } from "@/components/dashboard/allocation-donut";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SectorVsSp500 } from "@/components/dashboard/sector-vs-sp500";
import { StatCards } from "@/components/dashboard/stat-cards";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { PageHeader } from "@/components/shared/page-header";
import { SP500_AS_OF, SP500_SECTOR_WEIGHTS } from "@/config/sp500-sectors";
import { getPortfolio } from "@/data/holdings.repo";
import {
  allocationByClass,
  compareSectors,
  summarize,
  topHoldings,
} from "@/lib/portfolio/calc";

// Always read the latest data from the database.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { positions, cash, isDemoData } = await getPortfolio();
  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="Portfolio overview"
      actions={isDemoData ? <DemoBadge /> : undefined}
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
  const sectorRows = compareSectors(positions, SP500_SECTOR_WEIGHTS);

  return (
    <div className="space-y-3">
      {header}
      <StatCards summary={summary} />
      <div className="grid gap-3 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <AllocationDonut
            slices={allocationByClass(positions, cash)}
            totalValue={summary.totalValue}
          />
        </div>
        <div className="xl:col-span-3">
          <SectorVsSp500
            rows={sectorRows}
            asOf={SP500_AS_OF}
            hasSectorData={sectorRows.some((r) => r.portfolio > 0)}
          />
        </div>
      </div>
      <TopHoldings holdings={topHoldings(positions, cash, 5)} />
    </div>
  );
}
