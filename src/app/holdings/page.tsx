import { DemoBadge } from "@/components/dashboard/demo-badge";
import { AssetClassSection } from "@/components/holdings/asset-class-section";
import { CashCard } from "@/components/holdings/cash-card";
import { toExistingLots } from "@/components/holdings/existing-lots";
import { ImportDialog } from "@/components/holdings/import-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { getPortfolio } from "@/data/holdings.repo";
import { summarize, weight } from "@/lib/portfolio/calc";
import { HOLDING_CLASSES } from "@/lib/portfolio/types";

// Always read the latest data from the database.
export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const { positions, cash, isDemoData } = await getPortfolio();
  const { totalValue } = summarize(positions, cash);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Holdings"
        subtitle="Positions by asset class"
        actions={
          <>
            {isDemoData && <DemoBadge />}
            <ImportDialog existing={toExistingLots(positions)} />
          </>
        }
      />
      {HOLDING_CLASSES.map((assetClass) => (
        <AssetClassSection
          key={assetClass}
          assetClass={assetClass}
          positions={positions.filter((p) => p.assetClass === assetClass)}
          portfolioTotal={totalValue}
        />
      ))}
      <CashCard amount={cash} weightOfPortfolio={weight(cash, totalValue)} />
    </div>
  );
}
