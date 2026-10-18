import { countryName } from "@/config/countries";
import { SUBTYPE_OPTIONS, hasSubtype } from "@/config/subtypes";
import { gainLoss, gainLossPct, marketValue } from "./calc";
import type { Position } from "./types";

export type SortKey =
  | "ticker"
  | "name"
  | "sector"
  | "subtype"
  | "country"
  | "shares"
  | "costBasisPerShare"
  | "currentPrice"
  | "marketValue"
  | "gainLoss"
  | "gainLossPct"
  | "weight";
export type SortDir = "asc" | "desc";

function valueFor(p: Position, key: SortKey): string | number {
  switch (key) {
    case "ticker": return p.ticker;
    case "name": return p.name;
    case "sector": return p.sector ?? "";
    // By country name; holdings with no country sort as empty text.
    case "country": return countryName(p.country);
    // Maturity sorts short to long; type sorts in its list order; holdings with no value come last.
    case "subtype": {
      const i = hasSubtype(p.assetClass) && p.subtype ? (SUBTYPE_OPTIONS[p.assetClass] as readonly string[]).indexOf(p.subtype) : -1;
      return i === -1 ? 99 : i;
    }
    case "shares": return p.shares;
    case "costBasisPerShare": return p.costBasisPerShare;
    case "currentPrice": return p.currentPrice;
    case "marketValue":
    case "weight": return marketValue(p); // weight is proportional to market value
    case "gainLoss": return gainLoss(p);
    case "gainLossPct": return gainLossPct(p);
  }
}

/** Returns a sorted copy. Text sorts A-Z, numbers low-high; "desc" reverses. Ties fall back to ticker. */
export function sortPositions(positions: Position[], key: SortKey, dir: SortDir): Position[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...positions].sort((a, b) => {
    const va = valueFor(a, key);
    const vb = valueFor(b, key);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "en", { sensitivity: "base" });
    return cmp !== 0 ? sign * cmp : a.ticker.localeCompare(b.ticker);
  });
}

