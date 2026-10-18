"use client";

import { useState, useTransition } from "react";
import { saveHoldingAction } from "@/app/holdings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSubtype, SUBTYPE_LABEL, SUBTYPE_OPTIONS } from "@/config/subtypes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPrice, formatShares } from "@/lib/format";
import { fieldErrors, holdingSchema, SECTOR_OPTIONS, type HoldingInput } from "@/lib/holdings/schema";
import { mergePositions, type Lot } from "@/lib/portfolio/calc";
import type { DuplicateChoice } from "@/data/holdings.repo";
import type { HoldingClass, Position } from "@/lib/portfolio/types";
import { useTickerAutofill } from "./use-ticker-autofill";

const NO_SECTOR = "__none";

interface FormState {
  ticker: string;
  name: string;
  sector: string;
  subtype: string;
  shares: string;
  cost: string;
  price: string;
}

const blank = (): FormState => ({
  ticker: "", name: "", sector: NO_SECTOR, subtype: NO_SECTOR, shares: "", cost: "", price: "",
});

const fromPosition = (p: Position): FormState => ({
  ticker: p.ticker, name: p.name, sector: p.sector ?? NO_SECTOR, subtype: p.subtype ?? NO_SECTOR,
  shares: String(p.shares), cost: String(p.costBasisPerShare), price: String(p.currentPrice),
});

/** Add (position = null) or edit a holding within one asset class. */
export function HoldingFormDialog({
  open,
  onOpenChange,
  assetClass,
  position,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetClass: HoldingClass;
  position: Position | null;
  /** Positions already in this asset class, used to spot duplicate tickers. */
  existing: Position[];
}) {
  // Reset the form each time the dialog opens, by remounting the body.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <FormBody
            key={position?.id ?? "new"}
            assetClass={assetClass}
            position={position}
            existing={existing}
            close={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  assetClass,
  position,
  existing,
  close,
}: {
  assetClass: HoldingClass;
  position: Position | null;
  existing: Position[];
  close: () => void;
}) {
  const [form, setForm] = useState<FormState>(position ? fromPosition(position) : blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Set when the ticker already exists: shows the "add to existing or replace" step.
  const [duplicate, setDuplicate] = useState<{ current: Position; incoming: HoldingInput } | null>(null);
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const autofill = useTickerAutofill(form, setForm, assetClass, position?.ticker ?? "", NO_SECTOR);
  const isEquity = assetClass === "Equities";
  const subtypeLabel = hasSubtype(assetClass) ? SUBTYPE_LABEL[assetClass] : null;
  const valuesFor = (h: HoldingInput) => ({ ...h });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    const values = {
      ticker: form.ticker,
      name: form.name,
      assetClass,
      sector: isEquity && form.sector !== NO_SECTOR ? form.sector : null,
      subtype: !isEquity && form.subtype !== NO_SECTOR ? form.subtype : null,
      shares: num(form.shares),
      costBasisPerShare: num(form.cost),
      currentPrice: num(form.price),
    };
    const parsed = holdingSchema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      // Map schema names onto the form's field names.
      setErrors({ ...errs, cost: errs.costBasisPerShare, price: errs.currentPrice });
      return;
    }
    setErrors({});
    const clash = position ? undefined : existing.find((p) => p.ticker === parsed.data.ticker);
    if (clash) {
      setDuplicate({ current: clash, incoming: parsed.data });
      return;
    }
    save(values);
  };

  const save = (values: Record<string, unknown>, onDuplicate?: DuplicateChoice) => {
    startTransition(async () => {
      const res = await saveHoldingAction(position?.id ?? null, values, onDuplicate);
      if (res.ok) close();
      else {
        setDuplicate(null);
        setErrors({ ...res.errors, cost: res.errors.costBasisPerShare, price: res.errors.currentPrice });
      }
    });
  };

  const field = (id: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="label-caps">{label}</Label>
      <Input
        id={id}
        value={form[id]}
        onChange={(e) => set(id)(e.target.value)}
        aria-invalid={!!errors[id]}
        {...props}
      />
      {errors[id] && <p className="text-[11px] text-destructive">{errors[id]}</p>}
    </div>
  );

  if (duplicate) {
    const { current, incoming } = duplicate;
    const merged = mergePositions(current, incoming);
    // Columns: how the position looks now, if averaged, and if replaced.
    const columns = [
      { label: "Current", lot: current, highlight: false },
      { label: "If averaged", lot: merged, highlight: true },
      { label: "If replaced", lot: incoming, highlight: true },
    ];
    const fields = [
      { label: "Shares", value: (l: Lot) => formatShares(l.shares) },
      { label: "Cost / Share", value: (l: Lot) => formatPrice(l.costBasisPerShare) },
      { label: "Price", value: (l: Lot) => formatPrice(l.currentPrice) },
      { label: "Value", value: (l: Lot) => formatCurrency(l.shares * l.currentPrice) },
    ];
    return (
      <div className="space-y-3">
        <DialogHeader>
          <DialogTitle>{current.ticker} is already in {assetClass}</DialogTitle>
          <DialogDescription>
            Do you want to add this as an addition to your existing investment, or replace it with the new data?
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="label-caps border-b">
              <th className="py-1.5 text-left font-medium" />
              {columns.map((c) => (
                <th key={c.label} className={"py-1.5 text-right font-medium" + (c.highlight ? " text-primary" : "")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.label} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 text-muted-foreground">{f.label}</td>
                {columns.map((c) => (
                  <td key={c.label} className="num py-1.5">{f.value(c.lot)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground">
          Adding combines the shares and averages the cost per share (weighted by shares); the price
          comes from the new entry. Replacing overwrites the existing position with the new data.
        </p>
        <DialogFooter className="sm:flex-wrap">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setDuplicate(null)}>Back</Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => save(valuesFor(incoming), "replace")}
          >
            Replace with new data
          </Button>
          <Button type="button" disabled={pending} onClick={() => save(valuesFor(incoming), "merge")}>
            {pending ? "Saving…" : "Add to existing (average cost)"}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <DialogHeader>
        <DialogTitle>{position ? `Edit ${position.ticker}` : `Add to ${assetClass}`}</DialogTitle>
        <DialogDescription>
          Prices are entered by hand — update the price whenever you want fresh numbers.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        {field("ticker", "Ticker", { placeholder: "AAPL", autoCapitalize: "characters", autoFocus: true, onBlur: autofill.onBlur })}
        {field("name", "Name", { placeholder: "Apple Inc." })}
      </div>
      {autofill.state !== "idle" && (
        <p className="text-[11px] text-muted-foreground">
          {autofill.state === "looking" && "Looking up…"}
          {autofill.state === "found" && "Filled in automatically"}
          {autofill.state === "none" && "No data found, enter it by hand"}
        </p>
      )}
      {isEquity && (
        <div className="space-y-1">
          <Label className="label-caps">Sector (optional)</Label>
          <Select
            value={form.sector}
            onValueChange={(v) => v && set("sector")(v)}
            items={{ [NO_SECTOR]: "None", ...Object.fromEntries(SECTOR_OPTIONS.map((x) => [x, x])) }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SECTOR}>None</SelectItem>
              {SECTOR_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.sector && <p className="text-[11px] text-destructive">{errors.sector}</p>}
        </div>
      )}
      {hasSubtype(assetClass) && subtypeLabel && (
        <div className="space-y-1">
          <Label className="label-caps">{subtypeLabel} (optional)</Label>
          <Select
            value={form.subtype}
            onValueChange={(v) => v && set("subtype")(v)}
            items={{ [NO_SECTOR]: "Not set", ...Object.fromEntries(SUBTYPE_OPTIONS[assetClass].map((x) => [x, x])) }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SECTOR}>Not set</SelectItem>
              {SUBTYPE_OPTIONS[assetClass].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.subtype && <p className="text-[11px] text-destructive">{errors.subtype}</p>}
          <p className="text-[11px] text-muted-foreground">
            Leave it unset and use “Look up with Claude” on the Holdings page to fill it in for you.
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {field("shares", "Shares", { inputMode: "decimal", placeholder: "100" })}
        {field("cost", "Cost / share", { inputMode: "decimal", placeholder: "150.00" })}
        {field("price", "Price", { inputMode: "decimal", placeholder: "200.00" })}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : position ? "Save changes" : "Add holding"}</Button>
      </DialogFooter>
    </form>
  );
}
