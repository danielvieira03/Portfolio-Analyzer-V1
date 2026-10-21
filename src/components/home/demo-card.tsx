"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { CLASS_COLORS } from "@/components/dashboard/allocation-donut";
import { Num } from "@/components/shared/num";
import { Button } from "@/components/ui/button";
import type { DemoPortfolio } from "@/config/demo-portfolios";
import { formatPercent } from "@/lib/format";
import { allocationByClass } from "@/lib/portfolio/calc";
import { bondDurations, demoDoc } from "@/lib/portfolio/ledger";
import { displayScore, portfolioRisk, riskLabel } from "@/lib/portfolio/risk";

/** The numbers on a demo's card, worked out from the demo itself with the app's own functions. */
function cardFacts(demo: DemoPortfolio) {
  const d = demoDoc(demo.id);
  const slices = allocationByClass(d.holdings, d.cash);
  const score = portfolioRisk(d.holdings, d.cash, d.etfBreakdowns, bondDurations(d)).score ?? 0;
  return { slices, score: displayScore(score), label: riskLabel(score) };
}

export function DemoCard({ demo, onPick }: { demo: DemoPortfolio; onPick: () => void }) {
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
