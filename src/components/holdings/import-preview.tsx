"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPrice, formatShares } from "@/lib/format";
import { mergePositions } from "@/lib/portfolio/calc";
import type { ParsedImport, ParsedRow } from "@/lib/import/normalize";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HOLDING_CLASSES, type HoldingClass } from "@/lib/portfolio/types";
import type { Review } from "@/lib/ai/schema";
import { cn } from "@/lib/utils";

export type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | ({ status: "done" } & Review)
  | { status: "error"; message: string };

export type Mode = "add" | "replace";

/** A position already held, as far as the preview needs to know it. */
export interface ExistingLot {
  assetClass: string;
  ticker: string;
  name: string;
  sector: string | null;
  shares: number;
  costBasisPerShare: number;
}

export const lotKey = (assetClass: string, ticker: string) => `${assetClass}:${ticker}`;

/** Rows with their final fate once the user's choices are applied. `excluded` holds repeated tickers the user unticked. */
export function classify(parsed: ParsedImport, existing: Map<string, ExistingLot>, mode: Mode, excluded: Set<string>) {
  const isDuplicate = (r: ParsedRow) => mode === "add" && !!r.holding && existing.has(lotKey(r.holding.assetClass, r.holding.ticker));
  const isLeftOut = (r: ParsedRow) => isDuplicate(r) && excluded.has(lotKey(r.holding!.assetClass, r.holding!.ticker));
  const included = parsed.rows.filter((r) => r.status !== "error" && !isLeftOut(r));
  const holdings = included.filter((r) => r.holding).map((r) => r.holding!);
  const cashRows = included.filter((r) => r.cashAmount !== undefined);
  return {
    isDuplicate,
    isLeftOut,
    holdings,
    cashAmount: cashRows.length ? cashRows.reduce((t, r) => t + r.cashAmount!, 0) : undefined,
    counts: {
      warning: parsed.rows.filter((r) => r.status === "warning").length,
      error: parsed.rows.filter((r) => r.status === "error").length,
      duplicates: parsed.rows.filter(isDuplicate).length,
      leftOut: parsed.rows.filter(isLeftOut).length,
    },
  };
}

/** Old and new position for a repeated ticker once the file's shares are averaged in. */
function averaged(old: ExistingLot, h: NonNullable<ParsedRow["holding"]>) {
  const lot = (l: { name: string; sector: string | null; shares: number; costBasisPerShare: number; currentPrice?: number }) => ({
    ...l,
    currentPrice: l.currentPrice ?? 0,
    priceAsOf: new Date(0),
  });
  return mergePositions(lot(old), lot(h));
}

export function ImportPreview({
  parsed,
  existing,
  mode,
  onToggle,
  view,
  onAdjustColumns,
  onChooseAnother,
  error,
  defaultClass,
  setDefaultClass,
  readByClaude,
  aiIssues,
  review,
  onReview,
}: {
  parsed: ParsedImport;
  existing: Map<string, ExistingLot>;
  mode: Mode;
  onToggle: (key: string) => void;
  view: ReturnType<typeof classify>;
  onAdjustColumns?: () => void;
  onChooseAnother: () => void;
  error: string | null;
  defaultClass: HoldingClass;
  setDefaultClass: (c: HoldingClass) => void;
  /** True when the rows came from a screenshot/PDF that Claude read. */
  readByClaude: boolean;
  aiIssues: string[];
  review: ReviewState;
  onReview: () => void;
}) {
  const { isDuplicate, isLeftOut, counts, cashAmount } = view;
  const showCheck = counts.duplicates > 0;
  const headers = ["Ticker", "Name", "Sector", "Shares", "Cost / Sh", "Price", "Mkt Value"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {counts.warning > 0 && <Badge variant="outline" className="border-primary/50 text-primary">{counts.warning} with warnings</Badge>}
        {counts.error > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive">{counts.error} will be skipped (errors)</Badge>}
        {readByClaude && (
          <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
            <Sparkles /> Read by Claude
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1">
          {review.status === "done" && (
            <Button variant="outline" size="sm" onClick={onReview}>
              <Sparkles /> Double-check again
            </Button>
          )}
          {onAdjustColumns && <Button variant="link" size="sm" onClick={onAdjustColumns}>Adjust columns</Button>}
          <Button variant="link" size="sm" onClick={onChooseAnother}>Choose a different file</Button>
        </span>
      </div>
      {readByClaude && aiIssues.length > 0 && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-[12px]">
          <p className="label-caps mb-1 text-primary">Claude flagged on the document</p>
          <ul className="list-disc space-y-0.5 pl-4">{aiIssues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
      {review.status === "loading" && (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Claude is checking your file…
        </p>
      )}
      {review.status === "error" && <p className="text-[12px] text-muted-foreground">Claude check unavailable.</p>}
      {review.status === "done" && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-[12px]">
          <p className="label-caps mb-1 flex items-center gap-1.5 text-primary"><Sparkles className="size-3" /> Claude’s double-check</p>
          <p>{review.summary}</p>
          {review.flags.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {review.flags.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn("label-caps w-16 shrink-0", f.severity === "warning" ? "text-primary" : "text-muted-foreground")}>
                    {f.severity === "warning" ? "Check" : "Note"}
                  </span>
                  <span><span className="font-medium text-primary">{f.ticker}</span> — {f.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Based on general knowledge — Claude has no live prices. Nothing was changed; you decide what to import.
          </p>
        </div>
      )}

      {(!parsed.columns.assetClass || !parsed.columns.name) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-[12px]">
          {!parsed.columns.assetClass && (
            <span className="flex items-center gap-2">
              No asset class column in the file — import every row as
              <Select value={defaultClass} onValueChange={(v) => v && setDefaultClass(v as HoldingClass)}>
                <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLDING_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </span>
          )}
          {!parsed.columns.name && <span className="text-muted-foreground">No name column — tickers are used as names (you can edit them later).</span>}
        </div>
      )}

      {showCheck && (
        <p className="text-[12px] text-muted-foreground">
          <span className="font-medium text-primary">{counts.duplicates}</span>{" "}
          {counts.duplicates === 1 ? "ticker is" : "tickers are"} already in your holdings. Their shares are added and the cost per share is averaged.
          Untick any you’d rather leave out.
        </p>
      )}

      <div className="max-h-[min(24rem,45dvh)] overflow-auto rounded-md border">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="label-caps">
              {showCheck && <th className="sticky top-0 z-10 w-8 bg-popover px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)]" />}
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    // Opaque and above the rows so scrolling rows never show through or overlap it.
                    "sticky top-0 z-10 bg-popover px-2 py-1.5 font-medium shadow-[inset_0_-1px_0_var(--border)]",
                    i >= 3 ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((r) => {
              const h = r.holding;
              const key = h ? lotKey(h.assetClass, h.ticker) : "";
              const duplicate = isDuplicate(r);
              const old = duplicate ? existing.get(key) : undefined;
              const merged = old && h && !isLeftOut(r) ? averaged(old, h) : undefined;
              return (
                <tr key={r.line} className={cn("border-b border-border/50 align-top", r.status === "error" && "opacity-60")}>
                  {showCheck && (
                    <td className="px-2 py-1.5">
                      {duplicate && (
                        <input
                          type="checkbox"
                          checked={!isLeftOut(r)}
                          onChange={() => onToggle(key)}
                          aria-label={`Include ${r.label}`}
                          className="mt-0.5 accent-[var(--primary)]"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-2 py-1.5 font-medium text-primary">{r.label}</td>
                  <td className="min-w-40 max-w-72 px-2 py-1.5">
                    <div className="truncate">{h?.name ?? "—"}</div>
                    <p className="text-[11px] text-muted-foreground">{h?.assetClass ?? (r.cashAmount !== undefined ? "Cash" : "")}</p>
                    {duplicate && old && h && (
                      <p className="text-[11px] text-primary">
                        Already held
                        <span className="text-muted-foreground">
                          {merged
                            ? ` · ${formatShares(old.shares)} → ${formatShares(merged.shares)} sh, avg cost ${formatPrice(old.costBasisPerShare)} → ${formatPrice(merged.costBasisPerShare)}`
                            : " · left out, your position stays as it is"}
                        </span>
                      </p>
                    )}
                    {r.messages.map((m) => (
                      <p key={m} className={cn("text-[11px]", r.status === "error" ? "text-destructive" : r.status === "warning" ? "text-primary" : "text-muted-foreground")}>
                        {m}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{h?.sector ?? "—"}</td>
                  <td className="num px-2 py-1.5">{h ? formatShares(h.shares) : "—"}</td>
                  <td className="num px-2 py-1.5">{h ? formatPrice(h.costBasisPerShare) : "—"}</td>
                  <td className="num px-2 py-1.5">{h ? formatPrice(h.currentPrice) : "—"}</td>
                  <td className="num px-2 py-1.5">
                    {h ? formatCurrency(h.shares * h.currentPrice) : r.cashAmount !== undefined ? formatCurrency(r.cashAmount) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cashAmount !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          Cash rows total {formatPrice(cashAmount)} — {mode === "add" ? "added to" : "set as"} your cash balance.
        </p>
      )}
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
    </div>
  );
}
