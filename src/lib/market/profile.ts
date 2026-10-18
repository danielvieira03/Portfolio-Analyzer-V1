// Reads one answer from the market data profile lookup. Pure: no network, no database.

import { FMP_SECTOR_MAP } from "@/config/market";

export interface MarketProfile {
  name: string;
  price: number;
  /** The provider's own sector name (not yet translated), or null. */
  sector: string | null;
  isEtf: boolean;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The provider answers with a list of one item. Returns null when there is no usable price. */
export function parseProfile(json: unknown): MarketProfile | null {
  const item = Array.isArray(json) ? json[0] : null;
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const price = typeof r.price === "number" && Number.isFinite(r.price) ? r.price : 0;
  if (price <= 0) return null;
  return {
    name: str(r.companyName) ?? str(r.symbol) ?? "",
    price,
    sector: str(r.sector),
    isEtf: r.isEtf === true || r.isFund === true,
  };
}

/** The app's sector for a stock. ETFs and funds get none: the provider's sector for them is the fund company's. */
export function stockSector(profile: MarketProfile | null): string | null {
  if (!profile || profile.isEtf || !profile.sector) return null;
  return FMP_SECTOR_MAP[profile.sector] ?? null;
}
