"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { saveSubtypesAction } from "@/app/holdings/actions";
import { Num } from "@/components/shared/num";
import { Button } from "@/components/ui/button";
import { hasSubtype, SUBTYPE_LABEL } from "@/config/subtypes";
import { lookupSubtypesWithClaude } from "@/lib/ai/client";
import { formatCurrency, formatPercent } from "@/lib/format";
import { totalValue, weight } from "@/lib/portfolio/calc";
import type { HoldingClass, Position } from "@/lib/portfolio/types";
import { HoldingFormDialog } from "./holding-form-dialog";
import { HoldingsTable } from "./holdings-table";
import { RemoveHoldingDialog } from "./remove-holding-dialog";

/** One asset class: header with total + weight, sortable table, add/edit/remove. */
export function AssetClassSection({
  assetClass,
  positions,
  portfolioTotal,
}: {
  assetClass: HoldingClass;
  positions: Position[];
  portfolioTotal: number;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [removing, setRemoving] = useState<Position | null>(null);

  const classTotal = totalValue(positions);

  // Maturity (bonds) / type (alternatives): offer a Claude lookup for holdings that have none yet.
  const subtypeLabel = hasSubtype(assetClass) ? SUBTYPE_LABEL[assetClass] : null;
  const missing = hasSubtype(assetClass) ? positions.filter((p) => !p.subtype) : [];
  const [looking, startLookup] = useTransition();
  const [lookupNote, setLookupNote] = useState<{ text: string; error: boolean } | null>(null);
  const lookUp = () => {
    if (!hasSubtype(assetClass)) return;
    setLookupNote(null);
    startLookup(async () => {
      try {
        const items = missing.map((p) => ({ ticker: p.ticker, name: p.name, assetClass }));
        const found: Record<string, string> = {};
        for (let i = 0; i < items.length; i += 20) Object.assign(found, await lookupSubtypesWithClaude(items.slice(i, i + 20)));
        const res = await saveSubtypesAction(found);
        const n = res.ok ? res.updated : 0;
        setLookupNote({ text: n > 0 ? `Filled in ${n} ${n === 1 ? "holding" : "holdings"}.` : "Claude couldn’t find anything new.", error: false });
      } catch (e) {
        setLookupNote({ text: e instanceof Error ? e.message : "The lookup failed.", error: true });
      }
    });
  };

  return (
    <section className="panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold tracking-tight">{assetClass}</h2>
          <span className="label-caps">{positions.length} {positions.length === 1 ? "position" : "positions"}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="label-caps">Value</span>
            <Num className="font-semibold text-primary">{formatCurrency(classTotal)}</Num>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="label-caps">Weight</span>
            <Num className="font-semibold">{formatPercent(weight(classTotal, portfolioTotal), 1)}</Num>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {missing.length > 0 && subtypeLabel && (
            <Button
              size="sm"
              variant="outline"
              disabled={looking}
              onClick={lookUp}
            >
              {looking ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {looking ? `Looking up ${subtypeLabel.toLowerCase()}…` : `Look up ${subtypeLabel.toLowerCase()} with Claude`}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add
          </Button>
        </div>
      </header>
      {lookupNote && (
        <p className={"border-b px-3 py-1.5 text-[12px] " + (lookupNote.error ? "text-destructive" : "text-muted-foreground")}>
          {lookupNote.text}
        </p>
      )}

      {positions.length === 0 ? (
        <p className="px-3 py-8 text-center text-muted-foreground">
          No {assetClass.toLowerCase()} yet. Use Add to enter one, or Import a file.
        </p>
      ) : (
        <HoldingsTable
          positions={positions}
          portfolioTotal={portfolioTotal}
          assetClass={assetClass}
          onEdit={(p) => {
            setEditing(p);
            setFormOpen(true);
          }}
          onRemove={setRemoving}
        />
      )}

      <HoldingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assetClass={assetClass}
        position={editing}
        existing={positions}
      />
      <RemoveHoldingDialog position={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}
