import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";

export default function HoldingsPage() {
  return (
    <>
      <PageHeader title="Holdings" subtitle="Positions by asset class" />
      <Panel title="Coming soon">
        <p className="text-muted-foreground">
          Holdings tables and import arrive in a later checkpoint.
        </p>
      </Panel>
    </>
  );
}
