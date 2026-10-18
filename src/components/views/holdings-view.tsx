"use client";

import { DemoBadge } from "@/components/dashboard/demo-badge";
import { AssetClassSection } from "@/components/holdings/asset-class-section";
import { CashCard } from "@/components/holdings/cash-card";
import { toExistingLots } from "@/components/holdings/existing-lots";
import { ImportDialog } from "@/components/holdings/import-dialog";
import { PriceRefresh } from "@/components/holdings/price-refresh";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { LoadingPage } from "@/components/shared/loading-page";
import { PageHeader } from "@/components/shared/page-header";
import { summarize, weight } from "@/lib/portfolio/calc";
import { HOLDING_CLASSES } from "@/lib/portfolio/types";

export function HoldingsView() {
  const state = usePortfolio();
  if (!state) return <LoadingPage title="Holdings" subtitle="Positions by asset class" />;
  const { holdings: positions, cash, isDemoData, pricesUpdatedAt } = state.doc;
  const { totalValue } = summarize(positions, cash);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Holdings"
        subtitle="Positions by asset class"
        actions={
          <>
            {isDemoData && <DemoBadge />}
            <PriceRefresh updatedAt={pricesUpdatedAt} />
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
