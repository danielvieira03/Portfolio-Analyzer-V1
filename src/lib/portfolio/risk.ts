import { RISK_LABELS, RISK_MAX, RISK_MIN, RISK_WEIGHTS } from "@/config/risk";
import type { AllocationSlice } from "./calc";

/**
 * Risk score from the asset-class mix only: each class's share of the portfolio times its
 * risk weight, added together (100% equities = 5, 100% cash = 1). Null for an empty portfolio.
 */
export function riskScore(allocation: AllocationSlice[]): number | null {
  const total = allocation.reduce((t, s) => t + s.weight, 0);
  if (allocation.length === 0 || total <= 0) return null;
  return allocation.reduce((t, s) => t + s.weight * RISK_WEIGHTS[s.assetClass], 0);
}

/** The score as shown on screen: one decimal. */
export const displayScore = (score: number) => Math.round(score * 10) / 10;

/**
 * Risk type for a score. Rounds to the displayed one decimal first, then to the nearest whole
 * number (halves round up), so the number on screen and the label never disagree.
 */
export function riskLabel(score: number): string {
  const whole = Math.min(RISK_MAX, Math.max(RISK_MIN, Math.round(displayScore(score))));
  return RISK_LABELS[whole];
}

/** Where the score sits along the meter, as a fraction from 0 (left) to 1 (right). */
export const riskPosition = (score: number) =>
  Math.min(1, Math.max(0, (score - RISK_MIN) / (RISK_MAX - RISK_MIN)));
