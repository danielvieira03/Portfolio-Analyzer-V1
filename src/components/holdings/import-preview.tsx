"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, formatShares } from "@/lib/format";
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
export type Dup = "skip" | "merge" | "replace";

const DUP_OPTIONS: { value: Dup; title: string; text: string }[] = [
  { value: "skip", title: "Skip them", text: "Leave your existing positions untouched." },
  { value: "merge", title: "Add to existing (average cost)", text: "Combine shares and average the cost per share." },
  { value: "replace", title: "Replace existing", text: "Overwrite the position with the file’s data." },
];

/** Rows with their final fate once the user's choices are applied. */
export function classify(parsed: ParsedImport, existingKeys: Set<string>, mode: Mode, dup: Dup) {
  const isDuplicate = (r: ParsedRow) =>
    mode === "add" && !!r.holding && existingKeys.has(`${r.holding.assetClass}:${r.holding.ticker}`);
  const included = parsed.rows.filter((r) => r.status !== "error" && !(isDuplicate(r) && dup === "skip"));
  const holdings = included.filter((r) => r.holding).map((r) => r.holding!);
  const cashRows = included.filter((r) => r.cashAmount !== undefined);
  return {
    isDuplicate,
    holdings,
    cashAmount: cashRows.length ? cashRows.reduce((t, r) => t + r.cashAmount!, 0) : undefined,
    counts: {
      ok: parsed.rows.filter((r) => r.status === "ok").length,
      warning: parsed.rows.filter((r) => r.status === "warning").length,
      error: parsed.rows.filter((r) => r.status === "error").length,
      duplicates: parsed.rows.filter(isDuplicate).length,
    },
  };
}

export function ImportPreview({
  parsed,
  existingCount,
  mode,
  setMode,
  dup,
  setDup,
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
  existingCount: number;
  mode: Mode;
  setMode: (m: Mode) => void;
  dup: Dup;
  setDup: (d: Dup) => void;
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
  const { isDuplicate, counts, cashAmount } = view;
  const dupLabel = dup === "skip" ? "Skipped" : dup === "merge" ? "Will be averaged" : "Will replace";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {counts.warning > 0 && <Badge variant="outline" className="border-primary/50 text-primary">{counts.warning} with warnings</Badge>}
        {counts.error > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive">{counts.error} will be skipped (errors)</Badge>}
        {counts.duplicates > 0 && <Badge variant="outline">{counts.duplicates} already in your holdings</Badge>}
        {readByClaude && (
          <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
            <Sparkles /> Read by Claude
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onReview} disabled={review.status === "loading" || parsed.rows.every((r) => !r.holding)}>
            {review.status === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {review.status === "done" ? "Double-check again" : "Double-check with Claude"}
          </Button>
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
      {review.status === "error" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{review.message}</p>
      )}
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
            Advice only, based on general knowledge — Claude has no live prices. Nothing was changed; you decide what to import.
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

      <div className="max-h-[min(24rem,45dvh)] overflow-auto rounded-md border">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="label-caps">
              {["Row", "Ticker", "Name", "Class", "Shares", "Cost", "Price"].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    // Opaque and above the rows so scrolling rows never show through or overlap it.
                    "sticky top-0 z-10 bg-popover px-2 py-1.5 font-medium shadow-[inset_0_-1px_0_var(--border)]",
                    i >= 4 ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((r) => {
              const duplicate = isDuplicate(r);
              const h = r.holding;
              return (
                <tr key={r.line} className={cn("border-b border-border/50 align-top", (r.status === "error" || (duplicate && dup === "skip")) && "opacity-60")}>
                  <td className="num px-2 py-1.5 text-muted-foreground">{r.line}</td>
                  <td className="px-2 py-1.5 font-medium text-primary">{r.label}</td>
                  <td className="min-w-40 max-w-72 px-2 py-1.5">
                    <div className="truncate">{h?.name ?? "—"}</div>
                    {duplicate && (
                      <p className="text-[11px] text-primary">
                        {dupLabel} <span className="text-muted-foreground">· already in your holdings</span>
                      </p>
                    )}
                    {r.messages.map((m) => (
                      <p key={m} className={cn("text-[11px]", r.status === "error" ? "text-destructive" : r.status === "warning" ? "text-primary" : "text-muted-foreground")}>
                        {m}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-1.5">{h?.assetClass ?? (r.cashAmount !== undefined ? "Cash" : "—")}</td>
                  <td className="num px-2 py-1.5">{h ? formatShares(h.shares) : "—"}</td>
                  <td className="num px-2 py-1.5">{h ? formatPrice(h.costBasisPerShare) : "—"}</td>
                  <td className="num px-2 py-1.5">{h ? formatPrice(h.currentPrice) : r.cashAmount !== undefined ? formatPrice(r.cashAmount) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="label-caps mb-1.5">What should happen to your current holdings?</legend>
        {(
          [
            { value: "add", title: "Add to current", text: "Keep what you have and add the file’s holdings." },
            { value: "replace", title: "Replace", text: `Delete all ${existingCount} current holdings first, then import this file.` },
          ] as const
        ).map((o) => (
          <label key={o.value} className={cn("flex cursor-pointer gap-2.5 rounded-md border p-2.5", mode === o.value && "border-primary/70 bg-primary/5")}>
            <input type="radio" name="import-mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-0.5 accent-[var(--primary)]" />
            <span>
              <span className="block font-medium">{o.title}</span>
              <span className="block text-[11px] text-muted-foreground">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "add" && counts.duplicates > 0 && (
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="label-caps mb-1.5">
            {counts.duplicates} {counts.duplicates === 1 ? "ticker is" : "tickers are"} already in your holdings — what should happen to them?
          </legend>
          {DUP_OPTIONS.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer gap-2.5 rounded-md border p-2.5", dup === o.value && "border-primary/70 bg-primary/5")}>
              <input type="radio" name="import-dup" value={o.value} checked={dup === o.value} onChange={() => setDup(o.value)} className="mt-0.5 accent-[var(--primary)]" />
              <span>
                <span className="block font-medium">{o.title}</span>
                <span className="block text-[11px] text-muted-foreground">{o.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {cashAmount !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          Cash rows total {formatPrice(cashAmount)} — {mode === "add" ? "added to" : "set as"} your cash balance.
        </p>
      )}
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
    </div>
  );
}
