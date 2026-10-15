"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import { matchColumns, missingRequired, type ColumnMap } from "@/lib/import/columns";
import { parseImportRows } from "@/lib/import/normalize";
import { ACCEPT_ATTR, ACCEPTED_EXTENSIONS, readSpreadsheet } from "@/lib/import/parse-file";
import type { Table } from "@/lib/import/table";
import { ColumnMapper } from "./column-mapper";
import type { HoldingClass } from "@/lib/portfolio/types";
import { classify, ImportPreview, type Dup, type Mode } from "./import-preview";

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

type Step = "choose" | "map" | "preview";

function ImportBody({
  existing,
  close,
}: {
  existing: { assetClass: string; ticker: string }[];
  close: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("add");
  const [dup, setDup] = useState<Dup>("skip");
  const [defaultClass, setDefaultClass] = useState<HoldingClass>("Equities");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const existingKeys = useMemo(() => new Set(existing.map((e) => `${e.assetClass}:${e.ticker}`)), [existing]);
  const parsed = useMemo(
    () => (table && map ? parseImportRows(table.rows, table.headers, { columns: map, headerRow: table.headerRow, defaultAssetClass: defaultClass }) : null),
    [table, map, defaultClass],
  );
  const view = parsed ? classify(parsed, existingKeys, mode, dup) : null;

  const reset = () => {
    setStep("choose");
    setTable(null);
    setMap(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
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
      const res = await importHoldingsAction(mode, view.holdings, view.cashAmount, dup);
      if (res.ok) {
        const parts = [
          `${res.added} added`,
          res.merged ? `${res.merged} averaged into existing` : "",
          res.replaced ? `${res.replaced} replaced` : "",
          res.skipped ? `${res.skipped} skipped` : "",
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
      <DialogHeader>
        <DialogTitle>Import holdings</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {step === "choose" && (
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
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <p className="text-[11px] text-muted-foreground">
            The first row (or the first row with recognizable names) should be headers. Recognized
            names include Ticker/Symbol, Shares/Qty, Cost/Avg Cost, Price, Value, Asset Class and
            Sector. If your columns can’t be matched, you’ll be able to match them by hand.
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
          fileName={fileName}
          existingCount={existing.length}
          mode={mode}
          setMode={setMode}
          dup={dup}
          setDup={setDup}
          view={view}
          onAdjustColumns={() => setStep("map")}
          onChooseAnother={reset}
          error={error}
          showColumnsUsed
          defaultClass={defaultClass}
          setDefaultClass={setDefaultClass}
        />
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        {step === "preview" && view && (
          <Button
            onClick={save}
            disabled={pending || nothingToImport}
            variant={mode === "replace" ? "destructive" : "default"}
          >
            {pending ? "Importing…" : `${mode === "replace" ? "Replace with" : "Import"} ${view.holdings.length} ${view.holdings.length === 1 ? "holding" : "holdings"}`}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
