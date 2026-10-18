// What the Add/Edit form fills in after a ticker is typed. The server only supplies the market data
// profile; everything about the visitor's own portfolio (their fund library) is read in the browser.

import { hasSubtype } from "@/config/subtypes";
import type { FundRecord } from "@/lib/funds/library";
import { equitySector, type MarketProfile } from "@/lib/market/profile";

export interface TickerLookup {
  found: boolean;
  name?: string;
  price?: number;
  /** Equities form only: the stock's sector, or "Diversified" for an ETF. Never for bonds or alternatives. */
  sector?: string;
  /** Maturity (Fixed Income form) or type (Alternatives form), only when the fund library knows the fund. */
  subtype?: string;
}

const LOOKS_LIKE_TICKER = /^[A-Z0-9.^=\-]{1,12}$/;

export async function lookupTicker(
  ticker: string,
  assetClass: string,
  deps: {
    fetchProfile: (ticker: string) => Promise<MarketProfile | null>;
    libraryFunds: (tickers: string[]) => FundRecord[];
  },
): Promise<TickerLookup> {
  const t = ticker.trim().toUpperCase();
  if (!LOOKS_LIKE_TICKER.test(t)) return { found: false };
  const profile = await deps.fetchProfile(t);
  const sector = assetClass === "Equities" ? equitySector(profile) : null;
  const fund = hasSubtype(assetClass) ? deps.libraryFunds([t]).find((f) => f.assetClass === assetClass) : undefined;
  if (!profile && !fund) return { found: false };
  return {
    found: true,
    ...(profile ? { name: profile.name, price: profile.price } : {}),
    ...(sector ? { sector } : {}),
    ...(fund ? { subtype: fund.subtype } : {}),
  };
}
