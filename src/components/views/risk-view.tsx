"use client";

import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { DurationCard } from "@/components/risk/duration-card";
import { DurationContributors } from "@/components/risk/duration-contributors";
import { RiskProfile } from "@/components/risk/risk-profile";
import { SectorInsights } from "@/components/risk/sector-insights";
import { SectorVsSp500 } from "@/components/risk/sector-vs-sp500";
import { LoadingPage } from "@/components/shared/loading-page";
import { PageHeader } from "@/components/shared/page-header";
import { SP500_AS_OF, SP500_SECTOR_WEIGHTS } from "@/config/sp500-sectors";
import { allocationByClass, compareSectors } from "@/lib/portfolio/calc";
import { lookThroughExposure } from "@/lib/portfolio/exposure";
import { topContributors } from "@/lib/portfolio/duration";
import { bondDurations as durationsOf } from "@/lib/portfolio/ledger";
import { fundDataNote, unclassifiedNote } from "@/lib/portfolio/exposure-notes";
import { portfolioRisk, riskNote } from "@/lib/portfolio/risk";

export function RiskView() {
  const state = usePortfolio();
  if (!state) return <LoadingPage title="Risk Analysis" subtitle="Portfolio risk" />;
  const { holdings: positions, cash, isDemoData, etfBreakdowns, durations } = state.doc;

  const allocation = allocationByClass(positions, cash);
  const sectorRows = compareSectors(positions, SP500_SECTOR_WEIGHTS, etfBreakdowns);
  const bondDurations = durationsOf(state.doc);
  const risk = portfolioRisk(positions, cash, etfBreakdowns, bondDurations);
  const score = risk.score;
  const { sector, duration } = lookThroughExposure(positions, etfBreakdowns, { durations: bondDurations });
  const dataNote = [unclassifiedNote(sector.unclassified.weight, "sector"), fundDataNote(sector.oldestBreakdown, sector.fundsWithoutData)].filter(Boolean).join(" ");
  const contributors = topContributors(duration, 5);
  const notFound = Object.keys(durations).filter((t) => durations[t].years === null);
  const hasSectorData = sectorRows.some((r) => r.portfolio > 0);

  return (
    <div className="space-y-3">
      <PageHeader title="Risk Analysis" subtitle="Portfolio risk" actions={isDemoData ? <DemoBadge /> : undefined} />
      {score === null ? (
        <EmptyState title="No holdings yet" description="Upload your positions to see your Risk Profile." />
      ) : (
        <>
          <RiskProfile score={score} allocation={allocation} note={riskNote(risk)} />
          {hasSectorData ? (
            <div className="grid gap-3 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-3">
                <SectorVsSp500 rows={sectorRows} asOf={SP500_AS_OF} hasSectorData dataNote={dataNote} />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <SectorInsights rows={sectorRows} />
              </div>
            </div>
          ) : (
            <SectorVsSp500 rows={sectorRows} asOf={SP500_AS_OF} hasSectorData={false} dataNote={dataNote} />
          )}
          {contributors.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-3">
                <DurationCard view={duration} notFound={notFound} />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <DurationContributors rows={contributors} />
              </div>
            </div>
          ) : (
            <DurationCard view={duration} notFound={notFound} />
          )}
        </>
      )}
    </div>
  );
}
