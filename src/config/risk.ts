import type { AssetClass } from "@/lib/portfolio/types";

/** How risky each asset class is on the 1–5 scale. A portfolio's score is the weighted average of these. */
export const RISK_WEIGHTS: Record<AssetClass, number> = {
  Equities: 5,
  Alternatives: 3.5,
  "Fixed Income": 2,
  Cash: 1,
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
 * The comparison uses the average as displayed (one decimal), so 3.0 is intermediate and 7.0 is long.
 */
export const DURATION_BANDS = [
  { below: 1, label: "Ultra-Short Duration", range: "Under 1 year" },
  { below: 3, label: "Short Duration", range: "1 to 3 years" },
  { below: 7, label: "Intermediate Duration", range: "3 to 7 years" },
  { below: Infinity, label: "Long Duration", range: "7 years and over" },
] as const;
