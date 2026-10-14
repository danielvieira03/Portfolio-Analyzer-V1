"use client";

import { useRef, useState, useTransition } from "react";
import { FileImage, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { importHoldingsAction } from "@/app/holdings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice, formatShares } from "@/lib/format";
import { ACCEPTED_EXTENSIONS, readSpreadsheet } from "@/lib/import/parse-file";
import { parseImportRows, type ParsedImport, type ParsedRow } from "@/lib/import/normalize";
import { cn } from "@/lib/utils";

type Mode = "add" | "replace";

export function ImportDialog({
  existing,
}: {
  /** Current holdings, used to flag duplicates and to warn before replacing. */
  existing: { assetClass: string; ticker: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload /> Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          {open && <ImportBody existing={existing} close={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImportBody({
  existing,
  close,
}: {
  existing: { assetClass: string; ticker: string }[];
  close: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("add");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const existingKeys = new Set(existing.map((e) => `${e.assetClass}:${e.ticker}`));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Please choose a .csv, .xlsx or .xls file.");
      return;
    }
    try {
      const { rows, headers } = await readSpreadsheet(file);
      const result = parseImportRows(rows, headers);
      if (result.missingRequired.length) {
        setError(`Couldn't find these columns: ${result.missingRequired.join(", ")}. Check the header row of your file.`);
        return;
      }
      if (result.rows.length === 0) {
        setError("No rows found in the file.");
        return;
      }
      setFileName(file.name);
      setParsed(result);
    } catch {
      setError("That file couldn't be read. Is it a valid CSV or Excel file?");
    }
  };

  // Rows that will actually be saved with the current mode.
  const isDuplicate = (r: ParsedRow) =>
    mode === "add" && !!r.holding && existingKeys.has(`${r.holding.assetClass}:${r.holding.ticker}`);
  const importable = (parsed?.rows ?? []).filter((r) => r.status !== "error" && !isDuplicate(r));
  const holdings = importable.filter((r) => r.holding).map((r) => r.holding!);
  const cashRows = importable.filter((r) => r.cashAmount !== undefined);
  const cashAmount = cashRows.length ? cashRows.reduce((t, r) => t + r.cashAmount!, 0) : undefined;
  const counts = {
    ok: parsed?.rows.filter((r) => r.status === "ok").length ?? 0,
    warning: parsed?.rows.filter((r) => r.status === "warning").length ?? 0,
    error: parsed?.rows.filter((r) => r.status === "error").length ?? 0,
    skipped: parsed?.rows.filter(isDuplicate).length ?? 0,
  };

  const save = () =>
    startTransition(async () => {
      const res = await importHoldingsAction(mode, holdings, cashAmount);
      if (res.ok) setDone(`${res.added} imported${res.skipped ? `, ${res.skipped} skipped` : ""}.`);
      else setError(res.errors.form ?? "Import failed.");
    });

  if (done) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Import complete</DialogTitle>
          <DialogDescription>{done}</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={close}>Close</Button></DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import holdings</DialogTitle>
        <DialogDescription>
          {parsed
            ? `Review ${fileName} before anything is saved.`
            : "Choose where your holdings are coming from."}
        </DialogDescription>
      </DialogHeader>

      {!parsed ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-start gap-1.5 rounded-md border border-primary/60 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
            >
              <FileSpreadsheet className="size-5 text-primary" />
              <span className="font-medium">CSV or Excel</span>
              <span className="text-[11px] text-muted-foreground">.csv, .xlsx, .xls — click to choose a file</span>
            </button>
            {[
              { icon: FileImage, label: "Screenshot" },
              { icon: FileText, label: "PDF" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                aria-disabled="true"
                className="flex cursor-not-allowed flex-col items-start gap-1.5 rounded-md border border-dashed p-3 opacity-60"
              >
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex items-center gap-2 font-medium">
                  {label} <Badge variant="outline" className="h-4 text-[10px]">Coming soon</Badge>
                </span>
                <span className="text-[11px] text-muted-foreground">AI-assisted import arrives later</span>
              </div>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <p className="text-[11px] text-muted-foreground">
            The first row should be headers. Recognized names include Ticker/Symbol, Shares/Qty,
            Cost/Avg Cost, Price, Asset Class and Sector. Only Ticker, Shares and a Cost or Price
            are required.
          </p>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Badge variant="outline">{counts.ok} ready</Badge>
            {counts.warning > 0 && <Badge variant="outline" className="border-primary/50 text-primary">{counts.warning} with warnings</Badge>}
            {counts.error > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive">{counts.error} will be skipped (errors)</Badge>}
            {counts.skipped > 0 && <Badge variant="outline">{counts.skipped} already exist — skipped</Badge>}
            <Button variant="link" size="sm" className="ml-auto" onClick={() => { setParsed(null); setError(null); }}>
              Choose a different file
            </Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-popover">
                <tr className="label-caps border-b">
                  {["Row", "Ticker", "Name", "Class", "Shares", "Cost", "Price", "Status"].map((h, i) => (
                    <th key={h} className={cn("px-2 py-1.5 font-medium", i >= 4 && i <= 6 ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => {
                  const dup = isDuplicate(r);
                  const h = r.holding;
                  return (
                    <tr key={r.line} className={cn("border-b border-border/50 align-top", (r.status === "error" || dup) && "opacity-60")}>
                      <td className="num px-2 py-1.5 text-muted-foreground">{r.line}</td>
                      <td className="px-2 py-1.5 font-medium text-primary">{r.label}</td>
                      <td className="max-w-48 truncate px-2 py-1.5">{h?.name ?? "—"}</td>
                      <td className="px-2 py-1.5">{h?.assetClass ?? (r.cashAmount !== undefined ? "Cash" : "—")}</td>
                      <td className="num px-2 py-1.5">{h ? formatShares(h.shares) : "—"}</td>
                      <td className="num px-2 py-1.5">{h ? formatPrice(h.costBasisPerShare) : "—"}</td>
                      <td className="num px-2 py-1.5">{h ? formatPrice(h.currentPrice) : r.cashAmount !== undefined ? formatPrice(r.cashAmount) : "—"}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn(
                          "label-caps",
                          r.status === "error" && "text-destructive",
                          r.status === "warning" && "text-primary",
                        )}>
                          {dup ? "Skipped" : r.status === "ok" ? "OK" : r.status === "warning" ? "Warning" : "Error"}
                        </span>
                        {dup && <p className="text-[11px] text-muted-foreground">Already in your holdings</p>}
                        {r.messages.map((m) => (
                          <p key={m} className="text-[11px] text-muted-foreground">{m}</p>
                        ))}
                      </td>
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
                { value: "add", title: "Add to current", text: "Keep what you have. Tickers already in the same asset class are skipped." },
                { value: "replace", title: "Replace", text: `Delete all ${existing.length} current holdings first, then import this file.` },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-md border p-2.5",
                  mode === o.value && "border-primary/70 bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="import-mode"
                  value={o.value}
                  checked={mode === o.value}
                  onChange={() => setMode(o.value)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {cashAmount !== undefined && (
            <p className="text-[11px] text-muted-foreground">
              Cash rows total {formatPrice(cashAmount)} — {mode === "add" ? "added to" : "set as"} your cash balance.
            </p>
          )}
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        {parsed && (
          <Button
            onClick={save}
            disabled={pending || (holdings.length === 0 && cashAmount === undefined)}
            variant={mode === "replace" ? "destructive" : "default"}
          >
            {pending ? "Importing…" : `${mode === "replace" ? "Replace with" : "Import"} ${holdings.length} ${holdings.length === 1 ? "holding" : "holdings"}`}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
