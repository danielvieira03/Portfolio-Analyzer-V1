"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileImage, FileSpreadsheet, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { importHoldingsAction } from "@/app/holdings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AI_ACCEPT_ATTR, IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/config/ai";
import { readWithClaude, reviewWithClaude } from "@/lib/ai/client";
import { matchColumns, missingRequired, type ColumnMap } from "@/lib/import/columns";
import { parseImportRows } from "@/lib/import/normalize";
import { ACCEPT_ATTR, ACCEPTED_EXTENSIONS, readSpreadsheet } from "@/lib/import/parse-file";
import type { Table } from "@/lib/import/table";
import { ColumnMapper } from "./column-mapper";
import type { HoldingClass } from "@/lib/portfolio/types";
import { classify, ImportPreview, lotKey, type ExistingLot, type Mode, type ReviewState } from "./import-preview";
import { cn } from "@/lib/utils";

export function ImportDialog({
  existing,
}: {
  /** Current holdings, used to flag repeated tickers, show the averaged result and warn before replacing. */
  existing: ExistingLot[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload /> Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
          {open && <ImportBody existing={existing} close={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Step = "choose" | "map" | "preview";

function ImportBody({
  existing,
  close,
}: {
  existing: ExistingLot[];
  close: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("add");
  // Repeated tickers the user unticked (kept out of the import).
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [defaultClass, setDefaultClass] = useState<HoldingClass>("Equities");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  // Screenshot / PDF read by Claude
  const aiRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null); // name of the file Claude is reading
  const [readByClaude, setReadByClaude] = useState(false);
  const [aiIssues, setAiIssues] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewState>({ status: "idle" });

  const existingMap = useMemo(() => new Map(existing.map((e) => [lotKey(e.assetClass, e.ticker), e])), [existing]);
  const parsed = useMemo(
    () => (table && map ? parseImportRows(table.rows, table.headers, { columns: map, headerRow: table.headerRow, defaultAssetClass: defaultClass }) : null),
    [table, map, defaultClass],
  );
  const view = parsed ? classify(parsed, existingMap, mode, excluded) : null;

  const reset = () => {
    setStep("choose");
    setExcluded(new Set());
    setTable(null);
    setMap(null);
    setError(null);
    setReadByClaude(false);
    setAiIssues([]);
    setReview({ status: "idle" });
    if (fileRef.current) fileRef.current.value = "";
    if (aiRef.current) aiRef.current.value = "";
  };

  const onAiFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const isImage = (IMAGE_TYPES as readonly string[]).includes(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      setError("Please choose a PNG, JPEG, WebP or GIF screenshot, or a PDF.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Try a smaller screenshot or fewer pages.`);
      return;
    }
    setReading(file.name);
    try {
      const result = await readWithClaude(file);
      if (result.rows.length === 0) {
        setError(result.issues.length ? `Claude didn’t find any holdings: ${result.issues.join(" ")}` : "Claude didn’t find any holdings in that file.");
        return;
      }
      const m = matchColumns(result.headers);
      setFileName(file.name);
      setTable({ headers: result.headers, rows: result.rows, headerRow: 1 });
      setMap(m);
      setReadByClaude(true);
      setAiIssues(result.issues);
      setReview({ status: "idle" });
      setStep(missingRequired(m.columns).length ? "map" : "preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claude couldn’t read that file.");
    } finally {
      setReading(null);
      if (aiRef.current) aiRef.current.value = "";
    }
  };

  const onReview = async () => {
    if (!parsed) return;
    const rows = parsed.rows.filter((r) => r.holding).map((r) => ({
      ticker: r.holding!.ticker,
      name: r.holding!.name,
      assetClass: r.holding!.assetClass,
      sector: r.holding!.sector,
      shares: r.holding!.shares,
      costBasisPerShare: r.holding!.costBasisPerShare,
      currentPrice: r.holding!.currentPrice,
    }));
    setReview({ status: "loading" });
    try {
      setReview({ status: "done", ...(await reviewWithClaude(rows)) });
    } catch (e) {
      setReview({ status: "error", message: e instanceof Error ? e.message : "The double-check failed." });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Please choose a .csv, .xlsx or .xls file.");
      return;
    }
    try {
      const t = await readSpreadsheet(file);
      if (t.rows.length === 0) {
        setError("No rows were found in that file. The first sheet should have a header row followed by your holdings.");
        return;
      }
      const m = matchColumns(t.headers);
      setFileName(file.name);
      setTable(t);
      setMap(m);
      setStep(missingRequired(m.columns).length ? "map" : "preview");
    } catch {
      setError("That file couldn’t be read. Is it a valid CSV or Excel file?");
    }
  };

  const save = () => {
    if (!view) return;
    startTransition(async () => {
      const res = await importHoldingsAction(mode, view.holdings, view.cashAmount, "merge");
      if (res.ok) {
        const parts = [
          `${res.added} added`,
          res.merged ? `${res.merged} averaged into existing` : "",
          view.counts.leftOut ? `${view.counts.leftOut} left out` : "",
        ].filter(Boolean);
        setDone(parts.join(", ") + ".");
      } else setError(res.errors.form ?? "Import failed.");
    });
  };

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

  const description =
    step === "choose" ? "Choose where your holdings are coming from."
    : step === "map" ? `Match the columns in ${fileName}.`
    : `Review ${fileName} before anything is saved.`;

  const nothingToImport = !view || (view.holdings.length === 0 && view.cashAmount === undefined);

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle>Import holdings</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {/* Only this middle part scrolls; the header and the buttons stay in view. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
      {step === "choose" && (
        <div className="space-y-3">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="label-caps mb-1.5">What are you importing?</legend>
            {(
              [
                { value: "add", title: "Add additional holdings", text: "Keep what you have and add these. Repeated tickers are flagged and averaged." },
                { value: "replace", title: "New portfolio", text: `Replace all ${existing.length} current holdings with this file.` },
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
          <p className="label-caps">Where are they coming from?</p>
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
              { icon: FileImage, label: "Screenshot", hint: "PNG, JPEG, WebP — a photo or screenshot of your positions" },
              { icon: FileText, label: "PDF", hint: "A brokerage statement or positions report" },
            ].map(({ icon: Icon, label, hint }) => (
              <button
                key={label}
                type="button"
                disabled={reading !== null}
                onClick={() => {
                  if (aiRef.current) {
                    aiRef.current.accept = label === "PDF" ? "application/pdf,.pdf" : "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";
                    aiRef.current.click();
                  }
                }}
                className="flex flex-col items-start gap-1.5 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <Icon className="size-5 text-primary" />
                <span className="flex items-center gap-2 font-medium">
                  {label} <Sparkles className="size-3 text-primary" />
                </span>
                <span className="text-[11px] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          {reading && (
            <p className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-[12px]">
              <Loader2 className="size-4 animate-spin text-primary" />
              Claude is reading {reading}… this usually takes 5–15 seconds.
            </p>
          )}
          <input ref={aiRef} type="file" accept={AI_ACCEPT_ATTR} className="hidden" onChange={(e) => onAiFile(e.target.files?.[0])} />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <p className="text-[11px] text-muted-foreground">
            The first row (or the first row with recognizable names) should be headers. Recognized
            names include Ticker/Symbol, Shares/Qty, Cost/Avg Cost, Price, Value, Asset Class and
            Sector. If your columns can’t be matched, you’ll be able to match them by hand.
          </p>
          <p className="text-[11px] text-muted-foreground">
            <Sparkles className="mr-1 inline size-3 text-primary" />
            Screenshots and PDFs are sent to Claude (Anthropic’s API) to be read — this app doesn’t keep the
            file. CSV and Excel files are read locally and never leave your computer. Each screenshot or PDF
            costs roughly a cent or two of API credit.
          </p>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
        </div>
      )}

      {step === "map" && table && map && (
        <ColumnMapper
          headers={table.headers}
          map={map}
          onChange={setMap}
          onContinue={() => setStep("preview")}
          onBack={reset}
        />
      )}

      {step === "preview" && parsed && view && (
        <ImportPreview
          parsed={parsed}
          existing={existingMap}
          mode={mode}
          onToggle={(key) => setExcluded((prev) => { const n = new Set(prev); if (!n.delete(key)) n.add(key); return n; })}
          view={view}
          onAdjustColumns={() => setStep("map")}
          onChooseAnother={reset}
          readByClaude={readByClaude}
          aiIssues={aiIssues}
          review={review}
          onReview={onReview}
          error={error}
          defaultClass={defaultClass}
          setDefaultClass={setDefaultClass}
        />
      )}
      </div>

      <DialogFooter className="shrink-0">
        <Button variant="ghost" onClick={close}>Cancel</Button>
        {step === "preview" && view && (
          <Button
            onClick={save}
            disabled={pending || nothingToImport || review.status === "loading"}
            variant={mode === "replace" ? "destructive" : "default"}
          >
            {pending ? "Importing…" : `${mode === "replace" ? "Replace with" : "Import"} ${view.holdings.length} ${view.holdings.length === 1 ? "holding" : "holdings"}`}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
