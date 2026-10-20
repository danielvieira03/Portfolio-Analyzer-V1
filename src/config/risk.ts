import type { Sector } from "@/lib/portfolio/sectors";

/**
 * How risky each kind of holding is on the 1-5 scale. A portfolio's score is the average of these, weighted by market value.
 * Stocks (and the stocks inside equity ETFs) are scored by S&P 500 sector, bond funds by their own duration (the `risk` of
 * each band in `DURATION_BANDS`), alternatives by type, and cash at the bottom of the scale.
 */
export const RISK_SCORES = {
  cash: 1,
  /** Alternatives by type; "Other" is also what an alternative with no type counts as. */
  alternatives: { Infrastructure: 3.2, REITs: 3.4, Commodities: 3.8, Crypto: 5, Other: 3.5 } as Record<string, number>,
  /** Equities by S&P 500 sector. */
  sectors: {
    "Consumer Staples": 3.5,
    Utilities: 3.6,
    "Health Care": 3.7,
    Industrials: 3.9,
    "Real Estate": 4.0,
    Materials: 4.1,
    Financials: 4.2,
    "Communication Services": 4.3,
    "Consumer Discretionary": 4.4,
    Energy: 4.6,
    "Information Technology": 4.8,
  } satisfies Record<Sector, number>,
};

export const RISK_MIN = 1;
export const RISK_MAX = 5;

/** Risk type for each whole number on the scale. */
export const RISK_LABELS: Record<number, string> = {
  1: "Conservative",
  2: "Moderately Conservative",
  3: "Moderate",
  4: "Moderately Aggressive",
  5: "Aggressive",
};

/**
 * Duration types by average duration in years, shortest first. A band holds durations below `below`; the last one has no top.
 * The comparison uses the number as displayed (one decimal), so 3.0 is intermediate and 7.0 is long. `risk` is the band's risk score
 * (a bond fund is scored by its own duration, see `RISK_SCORES`).
 */
export const DURATION_BANDS = [
  { below: 1, label: "Ultra-Short Duration", range: "Under 1 year", risk: 1.5 },
  { below: 3, label: "Short Duration", range: "1 to 3 years", risk: 2 },
  { below: 7, label: "Intermediate Duration", range: "3 to 7 years", risk: 2.5 },
  { below: Infinity, label: "Long Duration", range: "7 years and over", risk: 3 },
] as const;
