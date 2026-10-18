"use client";

import { useRef, useState } from "react";
import { Download, HardDriveDownload, HardDriveUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportBackup, parseBackup } from "@/lib/portfolio/document";
import type { PortfolioDoc } from "@/lib/portfolio/ledger";
import { getBrowserStore } from "@/lib/storage/browser";

/** Backup button for the Holdings page: download the portfolio as a file, or restore one. */
export function BackupDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HardDriveDownload /> Backup
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">{open && <BackupBody close={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function BackupBody({ close }: { close: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // A backup that was read and is waiting for the visitor to confirm replacing the current portfolio.
  const [pending, setPending] = useState<PortfolioDoc | null>(null);

  const download = () => {
    const doc = getBrowserStore().getSnapshot().doc;
    const blob = new Blob([exportBackup(doc, new Date())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("That file couldn’t be read.");
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) setError(result.error);
    else setPending(result.doc);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (pending) {
    const current = getBrowserStore().getSnapshot().doc.holdings.length;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Replace your portfolio?</DialogTitle>
          <DialogDescription>
            This backup has {pending.holdings.length} {pending.holdings.length === 1 ? "holding" : "holdings"}. Restoring it
            replaces the {current} {current === 1 ? "holding" : "holdings"} and the cash currently saved in this browser. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          <Button
            onClick={() => {
              getBrowserStore().replace(pending);
              close();
            }}
          >
            Replace with backup
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Backup</DialogTitle>
        <DialogDescription>
          Your portfolio is saved in this browser only. Download a backup file to keep it safe, or to move it to another
          browser or device, and restore it here whenever you need.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={download}>
          <Download /> Download backup
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <HardDriveUpload /> Restore from file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Backup file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-[12px] text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={close}>Close</Button>
      </DialogFooter>
    </>
  );
}
