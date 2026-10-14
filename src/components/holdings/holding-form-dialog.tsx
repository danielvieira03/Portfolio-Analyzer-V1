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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { holdingSchema, fieldErrors, SECTOR_OPTIONS } from "@/lib/holdings/schema";
import type { HoldingClass, Position } from "@/lib/portfolio/types";

const NO_SECTOR = "__none";
const toDateInput = (d: Date) => new Date(d).toISOString().slice(0, 10);

interface FormState {
  ticker: string;
  name: string;
  sector: string;
  shares: string;
  cost: string;
  price: string;
  priceAsOf: string;
}

const blank = (): FormState => ({
  ticker: "", name: "", sector: NO_SECTOR, shares: "", cost: "", price: "",
  priceAsOf: toDateInput(new Date()),
});

const fromPosition = (p: Position): FormState => ({
  ticker: p.ticker, name: p.name, sector: p.sector ?? NO_SECTOR,
  shares: String(p.shares), cost: String(p.costBasisPerShare), price: String(p.currentPrice),
  priceAsOf: toDateInput(p.priceAsOf),
});

/** Add (position = null) or edit a holding within one asset class. */
export function HoldingFormDialog({
  open,
  onOpenChange,
  assetClass,
  position,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetClass: HoldingClass;
  position: Position | null;
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
  close,
}: {
  assetClass: HoldingClass;
  position: Position | null;
  close: () => void;
}) {
  const [form, setForm] = useState<FormState>(position ? fromPosition(position) : blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isEquity = assetClass === "Equities";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    const values = {
      ticker: form.ticker,
      name: form.name,
      assetClass,
      sector: isEquity && form.sector !== NO_SECTOR ? form.sector : null,
      shares: num(form.shares),
      costBasisPerShare: num(form.cost),
      currentPrice: num(form.price),
      priceAsOf: form.priceAsOf,
    };
    const parsed = holdingSchema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      // Map schema names onto the form's field names.
      setErrors({ ...errs, cost: errs.costBasisPerShare, price: errs.currentPrice });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveHoldingAction(position?.id ?? null, values);
      if (res.ok) close();
      else setErrors({ ...res.errors, cost: res.errors.costBasisPerShare, price: res.errors.currentPrice });
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

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <DialogHeader>
        <DialogTitle>{position ? `Edit ${position.ticker}` : `Add to ${assetClass}`}</DialogTitle>
        <DialogDescription>
          Prices are entered by hand — update the price and date whenever you want fresh numbers.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        {field("ticker", "Ticker", { placeholder: "AAPL", autoCapitalize: "characters", autoFocus: true })}
        {field("name", "Name", { placeholder: "Apple Inc." })}
      </div>
      {isEquity && (
        <div className="space-y-1">
          <Label className="label-caps">Sector (optional)</Label>
          <Select value={form.sector} onValueChange={(v) => v && set("sector")(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SECTOR}>None</SelectItem>
              {SECTOR_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.sector && <p className="text-[11px] text-destructive">{errors.sector}</p>}
          <p className="text-[11px] text-muted-foreground">
            Use “Diversified” for broad funds so they stay out of the sector comparison.
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {field("shares", "Shares", { inputMode: "decimal", placeholder: "100" })}
        {field("cost", "Cost / share", { inputMode: "decimal", placeholder: "150.00" })}
        {field("price", "Price", { inputMode: "decimal", placeholder: "200.00" })}
      </div>
      {field("priceAsOf", "Price as of", { type: "date" })}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : position ? "Save changes" : "Add holding"}</Button>
      </DialogFooter>
    </form>
  );
}
