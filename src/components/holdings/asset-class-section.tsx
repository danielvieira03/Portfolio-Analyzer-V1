"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Num } from "@/components/shared/num";
import { Button } from "@/components/ui/button";
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
      </header>

      {positions.length === 0 ? (
        <p className="px-3 py-8 text-center text-muted-foreground">
          No {assetClass.toLowerCase()} yet. Use Add to enter one, or Import a file.
        </p>
      ) : (
        <HoldingsTable
          positions={positions}
          portfolioTotal={portfolioTotal}
          showSector={assetClass === "Equities"}
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
