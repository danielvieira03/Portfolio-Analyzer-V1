import { Briefcase } from "lucide-react";
import { ImportDialog } from "@/components/holdings/import-dialog";

export function EmptyState({
  title = "No holdings yet",
  description = "Upload your positions and this dashboard will fill in with your allocation, sector mix and largest positions.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-md border bg-muted">
        <Briefcase className="size-5 text-primary" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-muted-foreground">{description}</p>
      <ImportDialog existing={[]} buttonLabel="Upload Your Portfolio" prominent buttonClassName="mt-4" />
    </div>
  );
}
