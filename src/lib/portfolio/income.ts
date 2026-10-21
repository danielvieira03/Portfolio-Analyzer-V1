// The Income tab's numbers: expected annual income from dividends and fund distributions, by holding and category,
// with a fixed low / high range. Pure and unit-tested; nothing here touches the network or the browser.
//
// Income is per holding (a stock's dividend, or what an ETF or bond fund pays out itself), so it does not use the
// look-through exposure function, which is about where money sits.

import { INCOME_CATEGORIES, INCOME_RANGE, INCOME_TOP_FLOW } from "@/config/income";
import { marketValue } from "./calc";
import type { HoldingClass, Position } from "./types";

export interface IncomeRange {
  /** Expected income minus the fixed range. */
  low: number;
  expected: number;
  /** Expected income plus the fixed range. */
  high: number;
}

/** A holding that pays income. */
export interface IncomeContributor {
  ticker: string;
  name: string;
  /** Market value of the holding. */
  value: number;
  /** Expected annual income in dollars: dividend per share x shares. */
  annual: number;
  /** Annual income / market value. */
  yield: number;
  /** Its share of its category's income (the contributors of a category add up to 1). */
  share: number;
}

export interface CategoryIncome {
  category: HoldingClass;
  income: IncomeRange;
  /** Total market value of the WHOLE category: non-payers and holdings with unknown income are in it. */
  value: number;
  /** Category income / whole category value; null when the category is empty. */
  yield: number | null;
  /** Category income / total portfolio value. The three categories' shares add up to the portfolio yield. */
  shareOfPortfolioYield: number;
  /** Holdings that pay income, biggest first. */
  contributors: IncomeContributor[];
  /** Holdings in the category. */
  holdingCount: number;
  /** Holdings whose dividend is not known yet (left out of the income, never guessed). */
  unavailable: { ticker: string; name: string }[];
}

export interface PortfolioIncome {
  total: IncomeRange;
  /** Expected annual income / 12: the same every month. */
  monthly: number;
  /** Total market value of the holdings plus cash. */
  portfolioValue: number;
  /** Expected annual income / portfolio value; null for an empty portfolio. */
  yield: number | null;
  /** Always the three categories, in order. */
  categories: CategoryIncome[];
  /** Market value of the holdings that pay income / total portfolio value (cash included, like the yield); 0 for an empty portfolio. */
  payingShare: number;
  /** Holdings that pay income, and all holdings (cash is not a holding). */
  contributingCount: number;
  holdingCount: number;
  unavailable: { ticker: string; name: string }[];
}

/** Low, expected and high for an expected amount. */
export const incomeRange = (expected: number): IncomeRange => ({ low: expected * (1 - INCOME_RANGE), expected, high: expected * (1 + INCOME_RANGE) });

/**
 * Expected annual income of the portfolio, pre-tax and with no reinvestment. A holding's income is its dividend per share
 * times its shares. A dividend of 0 is a holding that pays nothing ($0, left out of the lists); a missing dividend is
 * "unavailable": left out of the income and listed, never guessed. Cash interest is not counted (but cash is in the
 * portfolio value the portfolio yield is measured against).
 */
export function portfolioIncome(positions: Position[], cash: number): PortfolioIncome {
  const portfolioValue = positions.reduce((t, p) => t + marketValue(p), 0) + Math.max(0, cash);
  const categories: CategoryIncome[] = INCOME_CATEGORIES.map((category) => {
    const held = positions.filter((p) => p.assetClass === category);
    const unavailable: { ticker: string; name: string }[] = [];
    const paying: Omit<IncomeContributor, "share">[] = [];
    for (const p of held) {
      if (typeof p.dividend !== "number" || !Number.isFinite(p.dividend) || p.dividend < 0) {
        unavailable.push({ ticker: p.ticker.toUpperCase(), name: p.name });
        continue;
      }
      const value = marketValue(p);
      const annual = p.dividend * p.shares;
      if (annual > 0 && value > 0) paying.push({ ticker: p.ticker.toUpperCase(), name: p.name, value, annual, yield: annual / value });
    }
    const expected = paying.reduce((t, c) => t + c.annual, 0);
    const value = held.reduce((t, p) => t + marketValue(p), 0);
    return {
      category,
      income: incomeRange(expected),
      value,
      yield: value > 0 ? expected / value : null,
      shareOfPortfolioYield: portfolioValue > 0 ? expected / portfolioValue : 0,
      contributors: paying
        .sort((a, b) => b.annual - a.annual || a.ticker.localeCompare(b.ticker))
        .map((c) => ({ ...c, share: expected > 0 ? c.annual / expected : 0 })),
      holdingCount: held.length,
      unavailable,
    };
  });

  const expected = categories.reduce((t, c) => t + c.income.expected, 0);
  return {
    total: incomeRange(expected),
    monthly: expected / 12,
    portfolioValue,
    yield: portfolioValue > 0 ? expected / portfolioValue : null,
    categories,
    payingShare: portfolioValue > 0 ? categories.reduce((t, c) => t + c.contributors.reduce((u, h) => u + h.value, 0), 0) / portfolioValue : 0,
    contributingCount: categories.reduce((t, c) => t + c.contributors.length, 0),
    holdingCount: positions.length,
    unavailable: categories.flatMap((c) => c.unavailable),
  };
}

// ---- Sankey: where the income comes from ----

export interface FlowNode {
  name: string;
  /** What the node is, for its colour and tooltip. */
  kind: "holding" | "other" | "category" | "total";
  /** The holding's full name, or how many holdings an "Other" ribbon groups. */
  detail?: string;
  /** Expected annual income through this node, in dollars. */
  value: number;
  /** Low / expected / high, on the category and total nodes. */
  range?: IncomeRange;
}

export interface FlowLink {
  source: number;
  target: number;
  /** Expected annual income, in dollars. */
  value: number;
}

/**
 * Sankey data: on the left, for each category, its top income-producing holdings (`topN`, default 3) and then, fourth, one
 * "Other [category] holdings" ribbon for the rest of THAT category (only when it has more than `topN`), so at most 12 on the left;
 * in the middle the categories that have income; on the right "Total Annual Income". A category with no income is left out.
 * Every block is exactly as big as the ribbons flowing into it, and the categories add up to the total.
 */
export function incomeFlow(result: PortfolioIncome, topN = INCOME_TOP_FLOW): { nodes: FlowNode[]; links: FlowLink[] } {
  const left: FlowNode[] = [];
  const middle: FlowNode[] = [];
  const leftLinks: { from: number; category: number; value: number }[] = [];
  const active = result.categories.filter((c) => c.income.expected > 0);

  active.forEach((c, ci) => {
    middle.push({ name: c.category, kind: "category", value: c.income.expected, range: c.income });
    for (const h of c.contributors.slice(0, topN)) {
      left.push({ name: h.ticker, kind: "holding", detail: h.name, value: h.annual });
      leftLinks.push({ from: left.length - 1, category: ci, value: h.annual });
    }
    const rest = c.contributors.slice(topN);
    if (rest.length > 0) {
      const value = rest.reduce((t, h) => t + h.annual, 0);
      left.push({ name: `Other ${c.category} holdings`, kind: "other", detail: `${rest.length} ${rest.length === 1 ? "holding" : "holdings"}`, value });
      leftLinks.push({ from: left.length - 1, category: ci, value });
    }
  });

  const nodes: FlowNode[] = [...left, ...middle, { name: "Total Annual Income", kind: "total", value: result.total.expected, range: result.total }];
  const totalIndex = nodes.length - 1;
  const links: FlowLink[] = [
    ...leftLinks.map((l) => ({ source: l.from, target: left.length + l.category, value: l.value })),
    ...active.map((c, ci) => ({ source: left.length + ci, target: totalIndex, value: c.income.expected })),
  ];
  return { nodes: active.length > 0 ? nodes : [], links: active.length > 0 ? links : [] };
}
