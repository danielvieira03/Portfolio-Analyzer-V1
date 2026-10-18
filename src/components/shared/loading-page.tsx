import { PageHeader } from "./page-header";

/** Shown for a moment while the visitor's saved portfolio is read from their browser. */
export function LoadingPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div aria-busy="true">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="panel px-3 py-10 text-center text-muted-foreground">Loading your portfolio…</div>
    </div>
  );
}
