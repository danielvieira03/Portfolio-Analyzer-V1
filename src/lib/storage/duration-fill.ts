// Fills in the duration of bond funds that have none: asks Claude, saves what it finds in this browser's portfolio.
// BROWSER ONLY (it uses the browser store). Quiet: it never throws and shows nothing.

import { durationsDue } from "@/lib/funds/duration";
import { lookupDurationsWithClaude } from "@/lib/ai/client";
import { applyDurations, libraryFunds } from "@/lib/portfolio/ledger";
import { getBrowserStore } from "./browser";

/** After a lookup that failed to even run (offline, server trouble), wait this long before trying again. */
const FAILURE_PAUSE_MS = 10 * 60_000;

let running = false;
let pausedUntil = 0;

/**
 * Look up the durations of this portfolio's bond funds that are missing (see `durationsDue`: not in the fund library,
 * not already found, not tried within a week). One run at a time. A fund Claude finds nothing for is recorded as tried.
 */
export async function fillMissingDurations(): Promise<void> {
  if (running || Date.now() < pausedUntil) return;
  const store = getBrowserStore();
  const { doc, chosen } = store.getSnapshot();
  if (!chosen || doc.holdings.length === 0) return;
  const due = durationsDue(doc.holdings, libraryFunds(doc, doc.holdings.map((h) => h.ticker)), doc.durations, new Date());
  if (due.length === 0) return;

  running = true;
  try {
    const found = await lookupDurationsWithClaude(due);
    store.update((current) => applyDurations(current, found, due.map((d) => d.ticker), new Date()));
  } catch {
    pausedUntil = Date.now() + FAILURE_PAUSE_MS;
  } finally {
    running = false;
  }
}
