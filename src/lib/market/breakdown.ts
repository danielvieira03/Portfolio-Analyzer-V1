import { countryByName } from "@/config/countries";
import { FMP_SECTOR_MAP } from "@/config/market";
import type { EtfBreakdown } from "@/lib/portfolio/types";

/** A weight from the provider as a fraction: 30.5 or "30.5%" gives 0.305. Null for anything unusable. */
export function parseWeight(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace("%", "").trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n / 100;
}

function rows(json: unknown): Record<string, unknown>[] {
  return Array.isArray(json) ? json.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
}

/** The provider's sector weights in the app's sector names. Names the app doesn't use (e.g. "Cash & Others") are left out. */
export function parseSectorWeights(json: unknown): EtfBreakdown["sectors"] {
  const out = new Map<string, number>();
  for (const r of rows(json)) {
    const name = typeof r.sector === "string" ? FMP_SECTOR_MAP[r.sector.trim()] : undefined;
    const weight = parseWeight(r.weightPercentage);
    if (name && weight) out.set(name, (out.get(name) ?? 0) + weight);
  }
  return [...out.entries()].map(([name, weight]) => ({ name, weight }));
}

/** The provider's country weights as ISO codes. Names with no country (e.g. "Supranational") are left out. */
export function parseCountryWeights(json: unknown): EtfBreakdown["countries"] {
  const out = new Map<string, number>();
  for (const r of rows(json)) {
    const code = typeof r.country === "string" ? countryByName(r.country)?.code : undefined;
    const weight = parseWeight(r.weightPercentage);
    if (code && weight) out.set(code, (out.get(code) ?? 0) + weight);
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
  };
}
