import { countryByName } from "@/config/countries";
import { BREAKDOWN_MAPPING_VERSION, FMP_SECTOR_MAP } from "@/config/market";
import type { EtfBreakdown } from "@/lib/portfolio/types";

/** The sector translation, matched without regard to capital letters. */
const SECTOR_BY_LOWER = new Map(Object.entries(FMP_SECTOR_MAP).map(([k, v]) => [k.toLowerCase(), v]));

/** The app's sector for a provider's (or Claude's) sector name, or undefined if it isn't one we know. */
export const translateSectorName = (name: string): string | undefined => SECTOR_BY_LOWER.get(name.trim().toLowerCase());

/** One fund to look up. Bond funds skip the sector list (FMP only says "Cash & Others"), saving a call. */
export interface FundRequest {
  ticker: string;
  sectors: boolean;
}

/** The most the provider may report for one weight. Single-country funds come back a little over 100% (India: 100.14%). */
const MAX_WEIGHT_PERCENT = 110;

/** A weight from the provider as a fraction: 30.5 or "30.5%" gives 0.305. Slightly over 100% counts as 100%. Null for anything unusable. */
export function parseWeight(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace("%", "").trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_WEIGHT_PERCENT) return null;
  return Math.min(1, n / 100);
}

function rows(json: unknown): Record<string, unknown>[] {
  return Array.isArray(json) ? json.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
}

/** The provider's sector weights in the app's sector names. Names the app doesn't use (e.g. "Cash & Others") are left out. */
export function parseSectorWeights(json: unknown): EtfBreakdown["sectors"] {
  const out = new Map<string, number>();
  for (const r of rows(json)) {
    const name = typeof r.sector === "string" ? translateSectorName(r.sector) : undefined;
    const weight = parseWeight(r.weightPercentage);
    if (name && weight) out.set(name, Math.min(1, (out.get(name) ?? 0) + weight));
  }
  return [...out.entries()].map(([name, weight]) => ({ name, weight }));
}

/** The provider's country weights as ISO codes. Names with no country (e.g. "Supranational") are left out. */
export function parseCountryWeights(json: unknown): EtfBreakdown["countries"] {
  const out = new Map<string, number>();
  for (const r of rows(json)) {
    const code = typeof r.country === "string" ? countryByName(r.country)?.code : undefined;
    const weight = parseWeight(r.weightPercentage);
    if (code && weight) out.set(code, Math.min(1, (out.get(code) ?? 0) + weight));
  }
  return [...out.entries()].map(([code, weight]) => ({ code, weight }));
}

/** One fund's saved breakdown from the two provider answers; status "none" when neither gave anything usable. */
export function buildBreakdown(sectorJson: unknown, countryJson: unknown, now: Date): EtfBreakdown {
  const sectors = parseSectorWeights(sectorJson);
  const countries = parseCountryWeights(countryJson);
  return {
    sectors,
    countries,
    updatedAt: now.toISOString(),
    status: sectors.length > 0 || countries.length > 0 ? "ok" : "none",
    mapping: BREAKDOWN_MAPPING_VERSION,
  };
}
