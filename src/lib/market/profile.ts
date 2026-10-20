// Reads one answer from the market data profile lookup. Pure: no network, no database.

import { FMP_SECTOR_MAP } from "@/config/market";
import { DIVERSIFIED } from "@/lib/portfolio/sectors";

export interface MarketProfile {
  name: string;
  price: number;
  /** The provider's own sector name (not yet translated), or null. */
  sector: string | null;
  isEtf: boolean;
  /** The company's headquarters country (ISO two-letter code); null for ETFs and funds, or when the provider has none. */
  country: string | null;
  /** The provider's last-year dividend per share (0 = pays none), or null when it gave none. Used for the Income tab. */
  dividend?: number | null;
  /** Funds only, and only when looked up for the Add form: the provider's own fund category ("Core Investment Grade Bond"). */
  category?: string | null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The provider answers with a list of one item. Returns null when there is no usable price. */
export function parseProfile(json: unknown): MarketProfile | null {
  const item = Array.isArray(json) ? json[0] : null;
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const price = typeof r.price === "number" && Number.isFinite(r.price) ? r.price : 0;
  if (price <= 0) return null;
  const isEtf = r.isEtf === true || r.isFund === true;
  const country = str(r.country)?.toUpperCase() ?? null;
  const dividend = typeof r.lastDividend === "number" && Number.isFinite(r.lastDividend) && r.lastDividend >= 0 ? r.lastDividend : null;
  return {
    name: str(r.companyName) ?? str(r.symbol) ?? "",
    price,
    sector: str(r.sector),
    isEtf,
    country: !isEtf && country && /^[A-Z]{2}$/.test(country) ? country : null,
    dividend,
  };
}

/** The app's sector for a stock. ETFs and funds get none: the provider's sector for them is the fund company's. */
export function stockSector(profile: MarketProfile | null): string | null {
  if (!profile || profile.isEtf || !profile.sector) return null;
  return FMP_SECTOR_MAP[profile.sector] ?? null;
}

/** What the Equities form fills into Sector: "Diversified" for an ETF / fund, the translated sector for a stock, else nothing. */
export function equitySector(profile: MarketProfile | null): string | null {
  if (!profile) return null;
  return profile.isEtf ? DIVERSIFIED : stockSector(profile);
}

/**
 * Which asset class a fund belongs to, from the provider's category text ("Large Cap Equity", "Core Investment Grade Bond",
 * "Commodities"...). Null when the category doesn't say clearly, so an unclear fund is never refused.
 */
export function fundAssetClass(category: string | null | undefined): "Equities" | "Fixed Income" | "Alternatives" | null {
  const c = (category ?? "").toLowerCase();
  if (!c || /allocation|balanced|hybrid|\bmix\b|multi/.test(c)) return null; // mixed funds are never refused
  if (/bond|treasur|fixed income|credit|debt|mortgage|municipal|\btips\b/.test(c)) return "Fixed Income";
  if (/commodit|real estate|reit|crypto|bitcoin|digital asset|currenc|alternative|precious|managed futures/.test(c)) return "Alternatives";
  if (/equity|equities/.test(c)) return "Equities";
  return null;
}
