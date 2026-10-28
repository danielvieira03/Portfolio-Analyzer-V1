// The portfolio snapshot the Ask AI chat sends to Claude with every question: a compact summary of the numbers the app
// already shows. It only CALLS the shared functions (nothing is recalculated here) and rounds for size. When a new
// analytic is added to the app, add it here too (and to snapshot.test.ts) so the assistant can talk about it.

import { FALLBACK_BENCHMARK, type Benchmark } from "@/lib/market/benchmark";
import { allocationByClass, compareSectors, gainLossPct, summarize, topHoldings } from "@/lib/portfolio/calc";
import { countryExposure } from "@/lib/portfolio/country-exposure";
import { durationType, topContributors } from "@/lib/portfolio/duration";
import { lookThroughExposure } from "@/lib/portfolio/exposure";
import { portfolioIncome } from "@/lib/portfolio/income";
import { bondDurations, type PortfolioDoc } from "@/lib/portfolio/ledger";
import { displayScore, portfolioRisk, riskLabel } from "@/lib/portfolio/risk";
import { subtypeAllocation } from "@/lib/portfolio/subtype-allocation";

/** Holdings listed one by one; the rest are summed into one "smaller holdings" line. */
const MAX_HOLDINGS = 40;
const MAX_COUNTRIES = 10;
const MAX_LIST = 5;

const money = (n: number) => Math.round(n * 100) / 100;
const pct = (fraction: number) => Math.round(fraction * 1000) / 10; // 0.1234 -> 12.3
const years = (n: number) => Math.round(n * 10) / 10;

/** The snapshot as a plain object, or null when there are no holdings (the chat then asks the visitor to add some). */
export function buildPortfolioSnapshot(doc: PortfolioDoc, benchmark: Benchmark = FALLBACK_BENCHMARK) {
  const { holdings: positions, cash, etfBreakdowns } = doc;
  if (positions.length === 0) return null;

  const summary = summarize(positions, cash);
  const durations = bondDurations(doc);
  const risk = portfolioRisk(positions, cash, etfBreakdowns, durations);
  const exposure = lookThroughExposure(positions, etfBreakdowns, { durations });
  const countries = countryExposure(positions, etfBreakdowns);
  const income = portfolioIncome(positions, cash);

  const ranked = topHoldings(positions, cash, positions.length);
  const listed = ranked.slice(0, MAX_HOLDINGS);
  const rest = ranked.slice(MAX_HOLDINGS);

  const notes: string[] = [];
  if (doc.isDemoData) notes.push("This is a demo portfolio, not the visitor's own holdings.");
  if (risk.missingSector.length > 0) notes.push(`No sector data for: ${risk.missingSector.join(", ")} (left out of the risk score and sector comparison).`);
  if (risk.missingDuration.length > 0) notes.push(`No duration for: ${risk.missingDuration.join(", ")} (left out of the duration average and risk score).`);
  if (income.unavailable.length > 0) notes.push(`Income not available yet for: ${income.unavailable.map((u) => u.ticker).join(", ")} (left out of expected income).`);
  if (positions.some((p) => p.noLivePrice)) notes.push(`No live price for: ${positions.filter((p) => p.noLivePrice).map((p) => p.ticker.toUpperCase()).join(", ")} (a manual price is used).`);

  return {
    pricesUpdatedAt: doc.pricesUpdatedAt,
    totals: {
      portfolioValue: money(summary.totalValue),
      cash: money(cash),
      costBasis: money(summary.totalCost),
      gainLoss: money(summary.gainLoss),
      gainLossPct: pct(summary.gainLossPct),
      holdingCount: positions.length,
    },
    allocationByAssetClass: allocationByClass(positions, cash).map((s) => ({ assetClass: s.assetClass, value: money(s.value), weightPct: pct(s.weight) })),
    holdings: listed.map((h) => ({
      ticker: h.position.ticker.toUpperCase(),
      name: h.position.name,
      assetClass: h.position.assetClass,
      sector: h.position.sector,
      type: h.position.subtype,
      value: money(h.value),
      weightPct: pct(h.weight),
      gainLossPct: pct(gainLossPct(h.position)),
    })),
    smallerHoldings: rest.length === 0 ? null : { count: rest.length, value: money(rest.reduce((t, h) => t + h.value, 0)), weightPct: pct(rest.reduce((t, h) => t + h.weight, 0)) },
    risk: {
      scoreOutOf5: risk.score === null ? null : displayScore(risk.score),
      riskType: risk.score === null ? null : riskLabel(risk.score),
      shareOfPortfolioScoredPct: pct(risk.coverage),
      missingSector: risk.missingSector,
      missingDuration: risk.missingDuration,
    },
    sectorsVsSp500: {
      note: "Equities only (stocks plus equity ETFs split across their sectors); percentages are shares of the equities that have a sector.",
      benchmarkAsOf: benchmark.asOf,
      rows: compareSectors(positions, benchmark.weights, etfBreakdowns).map((r) => ({ sector: r.sector, portfolioPct: pct(r.portfolio), sp500Pct: pct(r.benchmark), differencePct: pct(r.difference) })),
      unclassifiedSharePct: pct(exposure.sector.unclassified.weight),
    },
    countries: {
      note: "Stocks by headquarters, funds split by their country weights; alternatives and cash are not included.",
      top: countries.rows.slice(0, MAX_COUNTRIES).map((r) => ({ country: r.name, weightPct: pct(r.weight) })),
      unclassifiedSharePct: pct(countries.unclassified.weight),
      fundsWithoutData: countries.fundsWithoutData,
    },
    income: {
      note: "Estimated from each holding's dividends per share over the last year; the low and high are the expected figure minus and plus 10%. Cash interest is not included.",
      expectedAnnual: money(income.total.expected),
      lowAnnual: money(income.total.low),
      highAnnual: money(income.total.high),
      monthly: money(income.monthly),
      portfolioYieldPct: income.yield === null ? null : pct(income.yield),
      shareOfPortfolioPayingIncomePct: pct(income.payingShare),
      byCategory: income.categories.map((c) => ({ category: c.category, expectedAnnual: money(c.income.expected), yieldPct: c.yield === null ? null : pct(c.yield) })),
      topPayers: income.categories
        .flatMap((c) => c.contributors)
        .sort((a, b) => b.annual - a.annual)
        .slice(0, MAX_LIST)
        .map((c) => ({ ticker: c.ticker, annual: money(c.annual), yieldPct: pct(c.yield) })),
    },
    bondDuration: {
      averageYears: exposure.duration.average === null ? null : years(exposure.duration.average),
      durationType: exposure.duration.average === null ? null : durationType(exposure.duration.average),
      topContributors: topContributors(exposure.duration, MAX_LIST).map((c) => ({ ticker: c.ticker, durationYears: years(c.years), shareOfBondFundsPct: pct(c.weight), shareOfAverageDurationPct: pct(c.shareOfDuration) })),
      fundsWithoutDuration: exposure.duration.withoutDuration.map((f) => f.ticker),
    },
    fixedIncomeByMaturity: subtypeAllocation(positions, "Fixed Income").slices.map((s) => ({ maturity: s.label, weightPct: pct(s.weight) })),
    alternativesByType: subtypeAllocation(positions, "Alternatives").slices.map((s) => ({ type: s.label, weightPct: pct(s.weight) })),
    dataNotes: notes,
  };
}

export type PortfolioSnapshot = NonNullable<ReturnType<typeof buildPortfolioSnapshot>>;

/** The snapshot as compact JSON text (what is sent to the server), or null for an empty portfolio. */
export function snapshotText(doc: PortfolioDoc, benchmark?: Benchmark): string | null {
  const snapshot = buildPortfolioSnapshot(doc, benchmark);
  return snapshot ? JSON.stringify(snapshot) : null;
}
