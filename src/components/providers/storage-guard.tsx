"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserStore } from "@/lib/storage/browser";
import { STORAGE_KEY } from "@/lib/storage/portfolio-store";
import { usePortfolio } from "./use-portfolio";

/**
 * Looks after the browser-side saving: keeps several open tabs in sync, asks the browser not to
 * delete the saved portfolio, and shows a quiet notice when saving isn't working normally.
 */
export function StorageGuard() {
  const state = usePortfolio();

  useEffect(() => {
    const store = getBrowserStore();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) store.reload();
    };
    window.addEventListener("storage", onStorage);
    void navigator.storage?.persist?.().catch(() => {});
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!state || state.status === "ok") return null;
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[12px]">
      <span>
        {state.status === "memory-only"
          ? "Your browser isn’t letting this app save data, so your changes will be lost when you close this tab."
          : "We couldn’t read your saved portfolio, so we started fresh. A copy of the unreadable data was kept in this browser."}
      </span>
      {state.status === "recovered" && (
        <Button size="sm" variant="outline" onClick={() => getBrowserStore().dismissNotice()}>
          OK
        </Button>
      )}
    </div>
  );
}
