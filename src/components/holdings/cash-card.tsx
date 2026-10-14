"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { saveCashAction } from "@/app/holdings/actions";
import { Num } from "@/components/shared/num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/format";

/** Cash is a single amount, not a table. */
export function CashCard({ amount, weightOfPortfolio }: { amount: number; weightOfPortfolio: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () => {
    setDraft(String(amount));
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const value = draft.trim() === "" ? NaN : Number(draft.replace(/[$,]/g, ""));
    startTransition(async () => {
      const res = await saveCashAction(value);
      if (res.ok) setEditing(false);
      else setError(res.errors.amount ?? "Enter a valid amount");
    });
  };

  return (
    <section className="panel flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">Cash</h2>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Cash amount"
              aria-invalid={!!error}
              className="num h-8 w-40"
            />
            {error && <span className="text-[11px] text-destructive">{error}</span>}
          </div>
        ) : (
          <>
            <Num className="text-lg font-semibold text-primary">{formatCurrency(amount)}</Num>
            <span className="flex items-baseline gap-1.5">
              <span className="label-caps">Weight</span>
              <Num className="font-semibold">{formatPercent(weightOfPortfolio, 1)}</Num>
            </span>
          </>
        )}
      </div>
      {editing ? (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={save} disabled={pending}><Check /> Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X /> Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={start}><Pencil /> Edit</Button>
      )}
    </section>
  );
}
