"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/shared/panel";
import { RISK_LABELS, RISK_MAX, RISK_MIN } from "@/config/risk";
import { formatPercent } from "@/lib/format";
import type { AllocationSlice } from "@/lib/portfolio/calc";
import { displayScore, riskLabel, riskPosition } from "@/lib/portfolio/risk";

const TICKS = Array.from({ length: RISK_MAX - RISK_MIN + 1 }, (_, i) => RISK_MIN + i);

export function RiskProfile({ score, allocation }: { score: number; allocation: AllocationSlice[] }) {
  const shown = displayScore(score);
  const label = riskLabel(score);
  const position = riskPosition(score) * 100;

  // The marker starts at the left edge and slides to the score once the page has loaded.
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Panel title="Risk Profile">
      <div className="py-2">
        {/* "Risk Level" sits at the card's left edge; the score and type stay centred over the meter. */}
        <div className="grid items-center gap-y-2 sm:grid-cols-[1fr_auto_1fr]">
          <h3 className="text-xl font-semibold">Risk Level</h3>
          <p className="flex flex-wrap items-baseline justify-center gap-x-3 text-center">
            <span className="font-mono text-2xl font-semibold tabular-nums text-primary">{shown.toFixed(1)}</span>
            <span className="hidden text-xl text-muted-foreground sm:inline">·</span>
            <span className="text-xl font-semibold">{label}</span>
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
        <div className="mt-9 px-4">
          <div className="relative">
            {/* Track: light warm orange on the left to the app's amber on the right, no other hues. */}
            <div
              className="h-3 rounded-full"
              style={{ background: "linear-gradient(to right, #FFF1DC, var(--primary))" }}
            />
            <div
              className="absolute top-0 z-10 h-3 w-6 -translate-x-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none"
              style={{ left: `${placed ? position : 0}%` }}
            >
              {/* Pin: a small triangle above the track and a thin line through it. */}
              <div className="absolute -top-2.5 left-1/2 size-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-foreground" />
              <div className="absolute -bottom-1 left-1/2 h-5 w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_1px_var(--background)]" />
            </div>

            {/* Tick marks 1 to 5 */}
            <div className="relative mt-3 h-8">
              {TICKS.map((t) => {
                const left = ((t - RISK_MIN) / (RISK_MAX - RISK_MIN)) * 100;
                return (
                  <div key={t} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${left}%` }}>
                    <div className="mx-auto h-1.5 w-px bg-muted-foreground/60" />
                    <span className="num mt-0.5 block text-[11px] text-muted-foreground">{t}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="label-caps">{RISK_LABELS[RISK_MIN]}</span>
            <span className="label-caps">{RISK_LABELS[RISK_MAX]}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-[13px] text-muted-foreground">
          {allocation.map((s, i) => (
            <span key={s.assetClass}>
              {i > 0 && " · "}
              {s.assetClass} <span className="num text-foreground">{formatPercent(s.weight, 1)}</span>
            </span>
          ))}
        </p>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">Risk based on asset-class mix only</p>
        </div>
      </div>
    </Panel>
  );
}
