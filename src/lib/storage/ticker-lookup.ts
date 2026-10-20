// What the Add/Edit form fills in after a ticker is typed. The server only supplies the market data
// profile; everything about the visitor's own portfolio (their fund library) is read in the browser.

import { hasSubtype } from "@/config/subtypes";
import type { FundRecord } from "@/lib/funds/library";
import { equitySector, fundAssetClass, type MarketProfile } from "@/lib/market/profile";
import { HOLDING_CLASSES, type HoldingClass } from "@/lib/portfolio/types";

export interface TickerLookup {
  found: boolean;
  name?: string;
  price?: number;
  /** Equities form only: the stock's sector, or "Diversified" for an ETF. Never for bonds or alternatives. */
  sector?: string;
  /** Equities form only: the stock's headquarters country (ISO code); never for ETFs, bonds or alternatives. */
  country?: string;
  /** Maturity (Fixed Income form) or type (Alternatives form), only when the fund library knows the fund. */
  subtype?: string;
  /** The ticker is known to belong to another asset class: nothing is filled and the form should refuse it. */
  wrongClass?: { assetClass: HoldingClass; message: string };
}

const FUND_KIND: Record<HoldingClass, string> = { Equities: "an equity fund", "Fixed Income": "a bond fund", Alternatives: "an alternatives fund" };

/** What the ticker is, when it is clear: the visitor's fund library first, then a stock (not a fund), then the fund's category. */
function knownClass(profile: MarketProfile | null, library: FundRecord | undefined): { assetClass: HoldingClass; stock: boolean } | null {
  if (library && (HOLDING_CLASSES as readonly string[]).includes(library.assetClass)) return { assetClass: library.assetClass as HoldingClass, stock: false };
  if (!profile) return null;
  if (!profile.isEtf) return { assetClass: "Equities", stock: true };
  const fromCategory = fundAssetClass(profile.category);
  return fromCategory ? { assetClass: fromCategory, stock: false } : null;
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
  const known = knownClass(profile, deps.libraryFunds([t])[0]);
  if (known && known.assetClass !== assetClass) {
    const what = known.stock ? "a stock" : FUND_KIND[known.assetClass];
    return { found: false, wrongClass: { assetClass: known.assetClass, message: `${t} is ${what}, so it belongs under ${known.assetClass}.` } };
  }
  const sector = assetClass === "Equities" ? equitySector(profile) : null;
  const fund = hasSubtype(assetClass) ? deps.libraryFunds([t]).find((f) => f.assetClass === assetClass) : undefined;
  if (!profile && !fund) return { found: false };
  return {
    found: true,
    ...(profile ? { name: profile.name, price: profile.price } : {}),
    ...(sector ? { sector } : {}),
    ...(assetClass === "Equities" && profile?.country ? { country: profile.country } : {}),
    ...(fund ? { subtype: fund.subtype } : {}),
  };
}
