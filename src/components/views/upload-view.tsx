"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { toExistingLots } from "@/components/holdings/existing-lots";
import { ImportFlowDialog, type InitialFile } from "@/components/holdings/import-dialog";
import type { Mode } from "@/components/holdings/import-preview";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { AI_ACCEPT_ATTR } from "@/config/ai";
import { ACCEPT_ATTR } from "@/lib/import/parse-file";
import { startEmptyPortfolio } from "@/lib/storage/browser";
import { cn } from "@/lib/utils";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";

const SOURCES = [
  { id: "table", icon: FileSpreadsheet, label: "CSV or Excel", hint: ".csv, .xlsx, .xls — click to choose a file", accept: ACCEPT_ATTR },
  { id: "image", icon: FileImage, label: "Screenshot", hint: "PNG, JPEG, WebP — a photo or screenshot of your positions", accept: IMAGE_ACCEPT },
  { id: "pdf", icon: FileText, label: "PDF", hint: "A brokerage statement or positions report", accept: "application/pdf,.pdf" },
] as const;

/** The three ways to bring in a portfolio. Choosing a file opens the same import preview as the Import button on Holdings. */
export function UploadView() {
  const router = useRouter();
  const state = usePortfolio();
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<(typeof SOURCES)[number]["id"]>("table");
  const [chosenFile, setChosenFile] = useState<InitialFile | null>(null);
  const [open, setOpen] = useState(false);
  const [imported, setImported] = useState(false);
  // With a portfolio of their own saved here, the visitor decides whether the file adds to it or replaces it.
  const [ownMode, setOwnMode] = useState<Mode>("add");

  const positions = state?.doc.holdings ?? [];
  const hasOwn = !!state && state.chosen && positions.length > 0 && !state.doc.isDemoData;

  const pick = (id: (typeof SOURCES)[number]["id"], accept: string) => {
    pending.current = id;
    if (inputRef.current) {
      inputRef.current.accept = accept;
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    startEmptyPortfolio(); // a first-time visitor becomes a visitor with an empty portfolio only now, once there is a file
    setImported(false);
    setChosenFile({ kind: pending.current === "table" ? "table" : "ai", file, mode: hasOwn ? ownMode : "replace" });
    setOpen(true);
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && imported) router.push("/dashboard");
  };

  return (
    <div className="-mt-9 space-y-6 pt-8">
      <section>
        <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Upload your own portfolio</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          Choose where your holdings are coming from. You will review everything before anything is saved, and missing sectors and maturities are filled in for you.
        </p>
      </section>

      {hasOwn && (
        <section className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="text-muted-foreground">You already have a portfolio saved here:</span>
          <div className="inline-flex rounded-md border p-0.5">
            {(
              [
                { value: "add", label: "Add to my portfolio" },
                { value: "replace", label: "Replace my portfolio" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOwnMode(o.value)}
                className={cn("rounded-[4px] px-3 py-1 text-[12px] transition-colors", ownMode === o.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {SOURCES.map(({ id, icon: Icon, label, hint, accept }) => (
          <button
            key={id}
            type="button"
            onClick={() => pick(id, accept)}
            className={cn(
              "panel flex flex-col items-start gap-2 p-5 text-left transition-colors",
              id === "table" ? "border-primary/60 bg-primary/5 hover:bg-primary/10" : "hover:border-primary/60 hover:bg-primary/5",
            )}
          >
            <Icon className="size-6 text-primary" />
            <span className="text-base font-semibold tracking-tight">{label}</span>
            <span className="text-[12px] text-muted-foreground">{hint}</span>
          </button>
        ))}
      </section>

      <p className="text-[11px] text-muted-foreground">
        A CSV or Excel file needs a header row with at least a ticker, the number of shares, and a cost or price. Column names don’t have to match exactly; if we can’t tell, you’ll match them yourself.
      </p>

      <input ref={inputRef} type="file" accept={`${ACCEPT_ATTR},${AI_ACCEPT_ATTR}`} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      <ImportFlowDialog
        existing={toExistingLots(positions)}
        open={open}
        onOpenChange={onOpenChange}
        initial={chosenFile ?? undefined}
        onImported={() => setImported(true)}
      />
    </div>
  );
}
