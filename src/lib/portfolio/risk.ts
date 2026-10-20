import { DURATION_BANDS, RISK_LABELS, RISK_MAX, RISK_MIN, RISK_SCORES } from "@/config/risk";
import { marketValue } from "./calc";
import { durationBandIndex } from "./duration";
import { lookThroughExposure } from "./exposure";
import { DIVERSIFIED } from "./sectors";
import type { EtfBreakdown, Position } from "./types";

export interface PortfolioRisk {
  /** 1 to 5, or null when nothing in the portfolio can be scored. */
  score: number | null;
  /** Fraction of the portfolio's value that was scored (1 = everything). */
  coverage: number;
  /** Equity holdings with no sector (a stock with none, an equity ETF with no saved sector weights), by ticker. */
  missingSector: string[];
  /** Bond funds with no duration, by ticker. */
  missingDuration: string[];
}

/**
 * The Risk Profile score: every holding is scored by what it is and the score is the average weighted by market value.
 * Stocks score by their sector, and equity ETFs are split across their sectors by the shared look-through function;
 * bond funds score by their own duration band; alternatives by type; cash at the bottom of the scale (see `RISK_SCORES`).
 * A holding whose sector or duration is not known is left out of the score (and listed), never guessed.
 */
export function portfolioRisk(
  positions: Position[],
  cash: number,
  breakdowns: Record<string, EtfBreakdown>,
  durations: Record<string, number>,
): PortfolioRisk {
  const exposure = lookThroughExposure(positions, breakdowns, { durations, sectorClasses: ["Equities"] });
  const everything = positions.reduce((t, p) => t + marketValue(p), 0) + Math.max(0, cash);

  let scored = 0;
  let points = 0;
  const add = (value: number, score: number) => {
    if (value > 0) {
      scored += value;
      points += value * score;
    }
  };

  add(Math.max(0, cash), RISK_SCORES.cash);
  for (const row of exposure.sector.rows) {
    const score = (RISK_SCORES.sectors as Record<string, number>)[row.key];
    if (score !== undefined) add(row.value, score);
  }
  for (const row of exposure.duration.rows) add(row.value, DURATION_BANDS[durationBandIndex(row.years)].risk);
  for (const p of positions) {
    if (p.assetClass !== "Alternatives") continue;
    const type = p.subtype && p.subtype in RISK_SCORES.alternatives ? p.subtype : "Other";
    add(marketValue(p), RISK_SCORES.alternatives[type]);
  }

  const missing = (list: Position[], has: (p: Position) => boolean) => [...new Set(list.filter((p) => marketValue(p) > 0 && !has(p)).map((p) => p.ticker.toUpperCase()))];
  const equities = positions.filter((p) => p.assetClass === "Equities");
  return {
    score: scored > 0 ? points / scored : null,
    coverage: everything > 0 ? scored / everything : 0,
    missingSector: missing(equities, (p) =>
      p.sector !== DIVERSIFIED ? !!p.sector && p.sector in RISK_SCORES.sectors : breakdowns[p.ticker.toUpperCase()]?.status === "ok" && breakdowns[p.ticker.toUpperCase()].sectors.length > 0,
    ),
    missingDuration: exposure.duration.withoutDuration.map((f) => f.ticker),
  };
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

const SHOWN = 4;
const list = (tickers: string[]) => (tickers.length > SHOWN ? `${tickers.slice(0, SHOWN).join(", ")} and ${tickers.length - SHOWN} more` : tickers.join(", "));

/** The small print under the meter: what the score is built from and, only when something had to be left out, how much it covers. */
export function riskNote(risk: Pick<PortfolioRisk, "coverage" | "missingSector" | "missingDuration">): string {
  const base = "Scored from equity sector exposure, bond duration, and alternative type";
  const parts: string[] = [];
  if (risk.missingSector.length > 0) parts.push(`No sector data for ${list(risk.missingSector)}`);
  if (risk.missingDuration.length > 0) parts.push(`no duration for ${list(risk.missingDuration)}`);
  if (parts.length === 0) return base;
  const text = parts.join("; ");
  return `${base}. Based on ${Math.floor(risk.coverage * 100)}% of your portfolio. ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
