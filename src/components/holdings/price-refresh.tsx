"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUpdated } from "@/lib/format";
import { refreshPrices, type PriceRefreshResult } from "@/lib/storage/browser-refresh";

/** A quiet note for the outcome of the last manual refresh; null = nothing worth saying. */
function noteFor(r: PriceRefreshResult): string | null {
  switch (r.status) {
    case "limit":
      return "Limit hit. Try again in a few seconds.";
    case "no_key":
      return "No market data key set";
    case "unreachable":
      return "Couldn’t update prices";
    default:
      return r.unavailable > 0 ? `${r.unavailable} without a live price` : null;
  }
}

/** "Prices updated 3:42 PM" plus a Refresh button for the Holdings header. */
export function PriceRefresh({ updatedAt }: { updatedAt: string | null }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => {
    setNote(null);
    startTransition(async () => {
      try {
        setNote(noteFor(await refreshPrices(true)));
      } catch {
        setNote("Couldn’t update prices");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground" suppressHydrationWarning>
        {note ?? (updatedAt ? `Prices updated ${formatUpdated(updatedAt)}` : "Prices not updated yet")}
      </span>
      <Button size="sm" variant="outline" disabled={pending} onClick={refresh}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Refresh
      </Button>
    </div>
  );
}
