"use client";

import { useEffect } from "react";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { BackupDialog } from "@/components/holdings/backup-dialog";
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

export function HoldingsView({ openImport = false }: { openImport?: boolean }) {
  const state = usePortfolio();
  // Arrived from "Upload your own": the dialog opens by itself, and the address goes back to plain /holdings.
  useEffect(() => {
    if (openImport) window.history.replaceState(null, "", "/holdings");
  }, [openImport]);
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
            <BackupDialog />
            <ImportDialog existing={toExistingLots(positions)} defaultOpen={openImport} />
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
