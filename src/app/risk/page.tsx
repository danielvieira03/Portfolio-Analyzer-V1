import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RiskProfile } from "@/components/risk/risk-profile";
import { PageHeader } from "@/components/shared/page-header";
import { getPortfolio } from "@/data/holdings.repo";
import { allocationByClass } from "@/lib/portfolio/calc";
import { riskScore } from "@/lib/portfolio/risk";

// Always read the latest data from the database.
export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const { positions, cash, isDemoData } = await getPortfolio();
  const allocation = allocationByClass(positions, cash);
  const score = riskScore(allocation);

  return (
    <div className="space-y-3">
      <PageHeader title="Risk Analysis" subtitle="Portfolio risk" actions={isDemoData ? <DemoBadge /> : undefined} />
      {score === null ? (
        <EmptyState title="No holdings yet" description="Upload your positions to see your Risk Profile." />
      ) : (
        <RiskProfile score={score} allocation={allocation} />
      )}
    </div>
  );
}
