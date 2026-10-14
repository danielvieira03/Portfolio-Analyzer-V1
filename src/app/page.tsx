import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Portfolio overview" />
      <Panel title="Coming next">
        <p className="text-muted-foreground">
          Summary cards and charts arrive in the next checkpoint.
        </p>
      </Panel>
    </>
  );
}
