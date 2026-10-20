// Closes the data gaps the Risk Profile needs, quietly: a stock with no sector, an equity ETF the market data has no sector
// weights for, a bond fund with no duration. Claude (web search) looks each one up and the answers are saved in this browser's
// portfolio. BROWSER ONLY (it uses the browser store). It never throws and shows nothing.

import { BREAKDOWN_MAPPING_VERSION } from "@/config/market";
import { gapsDue } from "@/lib/funds/gaps";
import { lookupBreakdownsWithClaude, lookupDurationsWithClaude, lookupSectorsWithClaude } from "@/lib/ai/client";
import { applyClaudeBreakdowns, applyClaudeSectors, applyDurations, libraryFunds } from "@/lib/portfolio/ledger";
import { getBrowserStore } from "./browser";

/** After a lookup that failed to even run (offline, server trouble), wait this long before trying again. */
const FAILURE_PAUSE_MS = 10 * 60_000;

let running = false;
let pausedUntil = 0;

/**
 * Look up what is missing, one kind at a time: stock sectors, then equity-ETF sector weights, then bond-fund durations.
 * Each answer is checked and saved as it arrives. A holding Claude finds nothing for is recorded as tried and asked again only
 * after a week. One run at a time; a failed lookup pauses everything for a few minutes.
 */
export async function fillMissingData(): Promise<void> {
  if (running || Date.now() < pausedUntil) return;
  const store = getBrowserStore();
  const { doc, chosen } = store.getSnapshot();
  if (!chosen || doc.holdings.length === 0) return;
  const gaps = gapsDue(doc.holdings, doc.etfBreakdowns, doc.durations, doc.sectorTries, libraryFunds(doc, doc.holdings.map((h) => h.ticker)), new Date());
  if (gaps.sectors.length + gaps.funds.length + gaps.durations.length === 0) return;

  running = true;
  try {
    if (gaps.sectors.length > 0) {
      const found = await lookupSectorsWithClaude(gaps.sectors);
      store.update((d) => applyClaudeSectors(d, found, gaps.sectors.map((g) => g.ticker), new Date()));
    }
    if (gaps.funds.length > 0) {
      const found = await lookupBreakdownsWithClaude(gaps.funds);
      store.update((d) => applyClaudeBreakdowns(d, found, gaps.funds.map((g) => g.ticker), new Date(), BREAKDOWN_MAPPING_VERSION));
    }
    if (gaps.durations.length > 0) {
      const found = await lookupDurationsWithClaude(gaps.durations);
      store.update((d) => applyDurations(d, found, gaps.durations.map((g) => g.ticker), new Date()));
    }
  } catch {
    pausedUntil = Date.now() + FAILURE_PAUSE_MS;
  } finally {
    running = false;
  }
}
