// Which holdings still miss what the Risk Profile needs, and so should be looked up by Claude. Pure: no network, no browser.

import { durationsDue } from "@/lib/funds/duration";
import type { FundRecord } from "@/lib/funds/library";
import { DIVERSIFIED } from "@/lib/portfolio/sectors";
import type { DurationRecord, EtfBreakdown, Position } from "@/lib/portfolio/types";

/** A lookup that found nothing is tried again only after this many days. */
export const GAP_RETRY_DAYS = 7;
/** The most holdings of each kind looked up in one run. */
export const GAP_MAX_PER_RUN = 10;

export interface Gaps {
  /** Stocks with no sector. */
  sectors: { ticker: string; name: string }[];
  /** Equity ETFs whose saved sector weights are missing (the market data had none) and must be read from the fund's page. */
  funds: { ticker: string; name: string }[];
  /** Bond funds with no duration. */
  durations: { ticker: string; name: string; assetClass: "Fixed Income" }[];
}

const recent = (iso: string | undefined, now: Date) => iso !== undefined && now.getTime() - Date.parse(iso) < GAP_RETRY_DAYS * 86_400_000;

export function gapsDue(
  holdings: Pick<Position, "ticker" | "name" | "assetClass" | "sector">[],
  breakdowns: Record<string, EtfBreakdown>,
  durations: Record<string, DurationRecord>,
  sectorTries: Record<string, string>,
  library: FundRecord[],
  now: Date,
): Gaps {
  const sectors = new Map<string, { ticker: string; name: string }>();
  const funds = new Map<string, { ticker: string; name: string }>();
  for (const h of holdings) {
    if (h.assetClass !== "Equities") continue;
    const t = h.ticker.toUpperCase();
    if (!h.sector) {
      if (!sectors.has(t) && !recent(sectorTries[t], now)) sectors.set(t, { ticker: t, name: h.name });
    } else if (h.sector === DIVERSIFIED) {
      // Only when the market data already answered with nothing: until then it has not been asked.
      const b = breakdowns[t];
      const missing = b !== undefined && (b.status === "none" || b.sectors.length === 0);
      if (missing && !funds.has(t) && !(b.source === "claude" && recent(b.updatedAt, now))) funds.set(t, { ticker: t, name: h.name });
    }
  }
  return {
    sectors: [...sectors.values()].slice(0, GAP_MAX_PER_RUN),
    funds: [...funds.values()].slice(0, GAP_MAX_PER_RUN),
    durations: durationsDue(holdings, library, durations, now),
  };
}
