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
