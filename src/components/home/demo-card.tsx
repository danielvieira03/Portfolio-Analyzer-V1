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
    <div className="panel flex flex-col p-6">
      <h3 className="text-xl font-semibold tracking-tight">{demo.name}</h3>
      <p className="mt-1.5 text-[14px] text-muted-foreground">{demo.tagline}</p>

      <div className="mt-8 flex items-baseline justify-between gap-2">
        <span className="label-caps">Risk</span>
        <span className="flex items-baseline gap-2">
          <Num className="text-2xl font-semibold text-primary">{score.toFixed(1)}</Num>
          <span className="text-[13px] text-muted-foreground">{label}</span>
        </span>
      </div>

      <div className="mt-5 flex h-4 overflow-hidden rounded-[2px]" role="img" aria-label={slices.map((s) => `${s.assetClass} ${formatPercent(s.weight, 0)}`).join(", ")}>
        {slices.map((s) => (
          <div key={s.assetClass} style={{ width: `${s.weight * 100}%`, background: CLASS_COLORS[s.assetClass] }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
        {slices.map((s) => (
          <li key={s.assetClass} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: CLASS_COLORS[s.assetClass] }} aria-hidden />
            <span className="truncate">{s.assetClass}</span>
            <Num className="ml-auto text-foreground">{formatPercent(s.weight, 0)}</Num>
          </li>
        ))}
      </ul>

      <p className="label-caps mt-10">Shows</p>
      <ul className="mb-8 mt-3.5 space-y-3.5 text-[14px] leading-relaxed text-muted-foreground">
        {demo.shows.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" aria-hidden />
            {line}
          </li>
        ))}
      </ul>

      <Button className="mt-auto w-full justify-center" size="lg" variant="outline" onClick={onPick}>
        Open this demo <ArrowRight />
      </Button>
    </div>
  );
}
