"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DemoCard } from "@/components/home/demo-card";
import { usePortfolio } from "@/components/providers/use-portfolio";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEMO_PORTFOLIOS, demoById, type DemoId } from "@/config/demo-portfolios";
import { startDemoPortfolio } from "@/lib/storage/browser";

/** The three demo portfolios. Choosing one asks first when it would replace the visitor's own saved portfolio. */
export function DemosView() {
  const router = useRouter();
  const state = usePortfolio();
  const [asking, setAsking] = useState<DemoId | null>(null);

  const wouldReplaceOwn = !!state && state.chosen && state.doc.holdings.length > 0 && !state.doc.isDemoData;

  const openDemo = (id: DemoId) => {
    startDemoPortfolio(id);
    setAsking(null);
    router.push("/dashboard");
  };
  const pick = (id: DemoId) => (wouldReplaceOwn ? setAsking(id) : openDemo(id));

  return (
    // The top bar is one row shorter on these pages, so pull the content up to match.
    <div className="-mt-9 space-y-6 pt-8">
      <section>
        <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Choose a demo portfolio</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">Each one is built to show something different. Pick one to explore the whole analyzer with it.</p>
      </section>

      <section>
        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_PORTFOLIOS.map((demo) => (
            <DemoCard key={demo.id} demo={demo} onPick={() => pick(demo.id)} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Demo holdings are examples, not recommendations. Prices were captured once and refresh when live market data is available.</p>
      </section>

      <AlertDialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your saved portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              Opening {asking ? demoById(asking).name : "this demo"} replaces the portfolio saved in this browser. If you want to keep yours, cancel and
              use Backup on the Holdings page first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => asking && openDemo(asking)}>
              Replace with demo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
