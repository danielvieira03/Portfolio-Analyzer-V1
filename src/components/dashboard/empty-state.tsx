import Link from "next/link";
import { Briefcase } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="panel flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-md border bg-muted">
        <Briefcase className="size-5 text-primary" />
      </div>
      <h2 className="text-base font-semibold">No holdings yet</h2>
      <p className="mt-1 max-w-sm text-muted-foreground">
        Add your positions on the Holdings tab and this dashboard will fill in with your allocation,
        sector mix and largest positions.
      </p>
      <Link href="/holdings" className={buttonVariants({ className: "mt-4" })}>
        Go to Holdings
      </Link>
    </div>
  );
}
