// The categories a Fixed Income holding (maturity) or an Alternatives holding (type) can have.
// The Claude lookup and the Holdings form only offer these values.

export const MATURITIES = ["Short-term", "Medium-term", "Long-term", "Not specified"] as const;
export const ALT_TYPES = ["Commodities", "REITs", "Crypto", "Infrastructure", "Other"] as const;

/** Allowed subtype values per asset class. Equities have none (they use Sector). */
export const SUBTYPE_OPTIONS = {
  "Fixed Income": MATURITIES,
  Alternatives: ALT_TYPES,
} as const;

/** Column / field name for each class. */
export const SUBTYPE_LABEL = { "Fixed Income": "Maturity", Alternatives: "Type" } as const;

/** What a holding with no value (or "not specified") is grouped under in charts. */
export const SUBTYPE_FALLBACK = { "Fixed Income": "Not specified", Alternatives: "Other" } as const;

/** What the maturity buckets mean, used in the Claude prompt and shown to the user. */
export const MATURITY_HELP =
  "Short-term = average maturity under about 3 years; Medium-term = 3 to 10 years; Long-term = over 10 years.";

export type SubtypeClass = keyof typeof SUBTYPE_OPTIONS;

export const hasSubtype = (assetClass: string): assetClass is SubtypeClass =>
  assetClass === "Fixed Income" || assetClass === "Alternatives";

export const isValidSubtype = (assetClass: string, value: string) =>
  hasSubtype(assetClass) && (SUBTYPE_OPTIONS[assetClass] as readonly string[]).includes(value);
