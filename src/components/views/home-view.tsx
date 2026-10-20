"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload } from "lucide-react";
import { CLASS_COLORS } from "@/components/dashboard/allocation-donut";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { Num } from "@/components/shared/num";
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
import { DEMO_PORTFOLIOS, demoById, type DemoId, type DemoPortfolio } from "@/config/demo-portfolios";
import { formatPercent } from "@/lib/format";
import { allocationByClass } from "@/lib/portfolio/calc";
import { demoDoc } from "@/lib/portfolio/ledger";
import { displayScore, riskLabel, riskScore } from "@/lib/portfolio/risk";
import { startDemoPortfolio, startEmptyPortfolio } from "@/lib/storage/browser";

/** The numbers on a demo's card, worked out from the demo itself with the app's own functions. */
function cardFacts(demo: DemoPortfolio) {
  const d = demoDoc(demo.id);
  const slices = allocationByClass(d.holdings, d.cash);
  const score = riskScore(slices) ?? 0;
  return { slices, score: displayScore(score), label: riskLabel(score) };
}

function DemoCard({ demo, onPick }: { demo: DemoPortfolio; onPick: () => void }) {
  const { slices, score, label } = useMemo(() => cardFacts(demo), [demo]);
  return (
    <div className="panel flex flex-col p-4">
      <h3 className="text-base font-semibold tracking-tight">{demo.name}</h3>
      <p className="mt-1 text-muted-foreground">{demo.tagline}</p>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span className="label-caps">Risk</span>
        <span className="flex items-baseline gap-2">
          <Num className="text-base font-semibold text-primary">{score.toFixed(1)}</Num>
          <span className="text-[12px] text-muted-foreground">{label}</span>
        </span>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-[2px]" role="img" aria-label={slices.map((s) => `${s.assetClass} ${formatPercent(s.weight, 0)}`).join(", ")}>
        {slices.map((s) => (
          <div key={s.assetClass} style={{ width: `${s.weight * 100}%`, background: CLASS_COLORS[s.assetClass] }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {slices.map((s) => (
          <li key={s.assetClass} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: CLASS_COLORS[s.assetClass] }} aria-hidden />
            <span className="truncate">{s.assetClass}</span>
            <Num className="ml-auto text-foreground">{formatPercent(s.weight, 0)}</Num>
          </li>
        ))}
      </ul>

      <p className="label-caps mt-4">Shows</p>
      <ul className="mt-1.5 space-y-1 text-[12px] text-muted-foreground">
        {demo.shows.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" aria-hidden />
            {line}
          </li>
        ))}
      </ul>

      <Button className="mt-5 w-full justify-center" variant="outline" onClick={onPick}>
        Open this demo <ArrowRight />
      </Button>
    </div>
  );
}

export function HomeView() {
  const router = useRouter();
  const state = usePortfolio();
  // Choosing a demo asks first when it would replace the visitor's own saved portfolio.
  const [asking, setAsking] = useState<DemoId | null>(null);

  const hasOwn = !!state && state.chosen && state.doc.holdings.length > 0;
  const ownIsDemo = !!state?.doc.isDemoData;
  const wouldReplaceOwn = hasOwn && !ownIsDemo;

  const openDemo = (id: DemoId) => {
    startDemoPortfolio(id);
    setAsking(null);
    router.push("/dashboard");
  };
  const pick = (id: DemoId) => (wouldReplaceOwn ? setAsking(id) : openDemo(id));
  const uploadOwn = () => {
    startEmptyPortfolio();
    router.push("/holdings?import=1");
  };

  return (
    // The top bar is one row shorter on this page, so pull the content up to match.
    <div className="-mt-9 space-y-8 pt-8">
      <section className="max-w-3xl">
        <p className="label-caps text-primary">Portfolio analytics</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">See what is really inside your portfolio.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Break a portfolio down by asset class, sector, country and risk, looking through ETFs and bond funds to what they actually hold.
          Explore a demo, or upload your own. Everything stays in your browser: no account, no login.
        </p>
        {hasOwn && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => router.push("/dashboard")}>
              Continue with {ownIsDemo ? "the demo" : "my portfolio"} <ArrowRight />
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {state!.doc.holdings.length} {state!.doc.holdings.length === 1 ? "holding" : "holdings"} saved in this browser
            </span>
          </div>
        )}
      </section>

      <section>
        <h2 className="label-caps mb-3">Explore a demo portfolio</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_PORTFOLIOS.map((demo) => (
            <DemoCard key={demo.id} demo={demo} onPick={() => pick(demo.id)} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Demo holdings are examples, not recommendations. Prices were captured once and refresh when live market data is available.</p>
      </section>

      <section className="panel flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Analyze your own portfolio</h2>
          <p className="mt-1 text-muted-foreground">Upload a CSV or Excel file, or a screenshot or PDF of your positions. Missing sectors and maturities are filled in for you.</p>
        </div>
        <Button className="shrink-0" onClick={uploadOwn}>
          <Upload /> Upload your own
        </Button>
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
