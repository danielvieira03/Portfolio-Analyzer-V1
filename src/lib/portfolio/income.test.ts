import { describe, expect, it } from "vitest";
import { incomeFlow, incomeRange, portfolioIncome } from "./income";
import type { HoldingClass, Position } from "./types";

const pos = (ticker: string, assetClass: HoldingClass, shares: number, price: number, dividend: number | null | undefined, o: Partial<Position> = {}): Position => ({
  id: ticker, ticker, name: `${ticker} Co`, assetClass, sector: assetClass === "Equities" ? "Energy" : null, subtype: null, shares, costBasisPerShare: price, currentPrice: price, dividend, ...o,
});
const income = (positions: Position[], cash = 0) => portfolioIncome(positions, cash);
const cat = (r: ReturnType<typeof portfolioIncome>, name: HoldingClass) => r.categories.find((c) => c.category === name)!;

describe("incomeRange", () => {
  it("is the expected amount minus and plus 10%", () => {
    expect(incomeRange(1000)).toEqual({ low: 900, expected: 1000, high: 1100 });
    expect(incomeRange(0)).toEqual({ low: 0, expected: 0, high: 0 });
  });
});

describe("portfolioIncome: income per holding", () => {
  it("a stock's income is its dividend per share x shares", () => {
    const r = income([pos("AAPL", "Equities", 100, 300, 1.06)]);
    expect(cat(r, "Equities").contributors[0]).toMatchObject({ ticker: "AAPL", annual: 106, value: 30_000 });
    expect(cat(r, "Equities").contributors[0].yield).toBeCloseTo(106 / 30_000);
  });
  it("an equity ETF counts in Equities with the stocks", () => {
    const r = income([pos("AAPL", "Equities", 100, 300, 1.06), pos("VOO", "Equities", 10, 700, 7.4282, { sector: "Diversified" })]);
    expect(cat(r, "Equities").contributors.map((c) => c.ticker)).toEqual(["AAPL", "VOO"]); // $106 then $74.28
    expect(cat(r, "Equities").income.expected).toBeCloseTo(106 + 74.282);
  });
  it("a bond or alternative fund's yield x value equals its dividend x shares", () => {
    const r = income([pos("BND", "Fixed Income", 1000, 70, 2.8), pos("VNQ", "Alternatives", 100, 90, 3.6)]);
    const bnd = cat(r, "Fixed Income").contributors[0];
    expect(bnd.yield).toBeCloseTo(2.8 / 70);
    expect(bnd.yield * bnd.value).toBeCloseTo(2800);
    expect(cat(r, "Alternatives").contributors[0].annual).toBeCloseTo(360);
  });
});

describe("portfolioIncome: ranges, totals and rates", () => {
  const r = income([pos("A", "Equities", 100, 100, 2), pos("B", "Fixed Income", 100, 50, 3), pos("C", "Alternatives", 100, 40, 1)], 1000);
  it("adds the categories and gives low / high for the total and each category", () => {
    expect(r.total.expected).toBeCloseTo(200 + 300 + 100);
    expect(r.total.low).toBeCloseTo(600 * 0.9);
    expect(r.total.high).toBeCloseTo(600 * 1.1);
    expect(cat(r, "Fixed Income").income).toEqual({ low: 270, expected: 300, high: 330 });
  });
  it("monthly is a twelfth of the year", () => {
    expect(r.monthly).toBeCloseTo(50);
  });
  it("portfolio yield is income over the whole portfolio value, cash included", () => {
    // value = 10,000 + 5,000 + 4,000 + 1,000 cash = 20,000
    expect(r.portfolioValue).toBe(20_000);
    expect(r.yield).toBeCloseTo(600 / 20_000);
  });
  it("category yield is on the WHOLE category value, and the categories' shares add up to the portfolio yield", () => {
    expect(cat(r, "Equities").yield).toBeCloseTo(200 / 10_000);
    expect(cat(r, "Fixed Income").yield).toBeCloseTo(300 / 5_000);
    const shares = r.categories.reduce((t, c) => t + c.shareOfPortfolioYield, 0);
    expect(shares).toBeCloseTo(r.yield!);
    expect(cat(r, "Equities").shareOfPortfolioYield).toBeCloseTo(200 / 20_000);
  });
  it("counts the holdings that contribute out of all holdings (cash is not a holding)", () => {
    expect(r.contributingCount).toBe(3);
    expect(r.holdingCount).toBe(3);
  });
});

describe("portfolioIncome: holdings that pay nothing or have no data", () => {
  const r = income([
    pos("PAYS", "Equities", 100, 100, 2),
    pos("NONE", "Equities", 100, 100, 0), // pays nothing
    pos("UNKNOWN", "Equities", 100, 100, null), // dividend not known yet
    pos("MISSING", "Fixed Income", 100, 50, undefined),
    pos("GLD", "Alternatives", 10, 300, 0),
    pos("VNQ", "Alternatives", 100, 90, 3.6),
  ]);
  it("a zero dividend is $0 and stays out of the lists, but is part of the category value", () => {
    expect(cat(r, "Equities").contributors.map((c) => c.ticker)).toEqual(["PAYS"]);
    expect(cat(r, "Equities").unavailable.map((u) => u.ticker)).toEqual(["UNKNOWN"]);
    expect(cat(r, "Equities").yield).toBeCloseTo(200 / 30_000); // PAYS + NONE + UNKNOWN all in the base
  });
  it("a missing dividend is listed as unavailable and never guessed", () => {
    expect(r.unavailable.map((u) => u.ticker)).toEqual(["UNKNOWN", "MISSING"]);
    expect(cat(r, "Fixed Income").income.expected).toBe(0);
    expect(cat(r, "Fixed Income").contributors).toEqual([]);
  });
  it("alternatives that pay nothing (gold) are not listed but stay in the category value for its yield", () => {
    const alts = cat(r, "Alternatives");
    expect(alts.contributors.map((c) => c.ticker)).toEqual(["VNQ"]);
    expect(alts.value).toBe(3_000 + 9_000);
    expect(alts.yield).toBeCloseTo(360 / 12_000);
  });
  it("counts only holdings with income as contributing", () => {
    expect(r.contributingCount).toBe(2);
    expect(r.holdingCount).toBe(6);
  });
});

describe("portfolioIncome: contributors", () => {
  const r = income([pos("A", "Equities", 100, 10, 1), pos("B", "Equities", 100, 10, 3), pos("C", "Equities", 100, 10, 2), pos("D", "Equities", 100, 10, 2)]);
  it("are sorted by income (ties by ticker) and their shares add up to 100%", () => {
    const c = cat(r, "Equities").contributors;
    expect(c.map((x) => x.ticker)).toEqual(["B", "C", "D", "A"]);
    expect(c.reduce((t, x) => t + x.share, 0)).toBeCloseTo(1);
    expect(c[0].share).toBeCloseTo(300 / 800);
  });
});

describe("portfolioIncome: empty and cash-only portfolios", () => {
  it("an empty portfolio has no income and no division by zero", () => {
    const r = income([], 0);
    expect(r.total.expected).toBe(0);
    expect(r.yield).toBeNull();
    expect(r.monthly).toBe(0);
    expect(r.categories.every((c) => c.yield === null && c.shareOfPortfolioYield === 0)).toBe(true);
  });
  it("cash earns nothing here: a cash-only portfolio has zero income and a zero yield", () => {
    const r = income([], 5000);
    expect(r.total.expected).toBe(0);
    expect(r.yield).toBe(0);
  });
});

describe("incomeFlow", () => {
  const many = (cls: HoldingClass, n: number, base = 1) => Array.from({ length: n }, (_, i) => pos(`${cls[0]}${i}`, cls, 100, 10, base + i * 0.1));
  it("shows only the top 3 holdings of each category, so at most 9 individual holdings and never a group", () => {
    const r = income([...many("Equities", 5), ...many("Fixed Income", 4), ...many("Alternatives", 3)]);
    const flow = incomeFlow(r);
    const holdings = flow.nodes.filter((n) => n.kind === "holding");
    expect(holdings).toHaveLength(9);
    expect(flow.nodes.every((n) => !/other/i.test(n.name))).toBe(true);
    // the biggest three of Equities (E4, E3, E2) and nothing smaller
    const equitiesIn = flow.links.filter((l) => flow.nodes[l.target].name === "Equities").map((l) => flow.nodes[l.source].name).sort();
    expect(equitiesIn).toEqual(["E2", "E3", "E4"]);
  });
  it("shows fewer than 3 when a category has fewer income-producing holdings", () => {
    const flow = incomeFlow(income([...many("Equities", 2), ...many("Fixed Income", 1)]));
    expect(flow.nodes.filter((n) => n.kind === "holding")).toHaveLength(3);
  });
  it("leaves out a category with no income, and holdings that pay nothing", () => {
    const flow = incomeFlow(income([pos("A", "Equities", 100, 10, 1), pos("GLD", "Alternatives", 10, 300, 0), pos("B", "Fixed Income", 10, 10, null)]));
    expect(flow.nodes.map((n) => n.name)).toEqual(["A", "Equities", "Total Annual Income"]);
  });
  it("is drawn so every block is exactly as big as the ribbons that flow into it (it connects cleanly)", () => {
    const r = income([...many("Equities", 5), ...many("Fixed Income", 4), pos("VNQ", "Alternatives", 100, 90, 3.6)]);
    const { nodes, links } = incomeFlow(r);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].kind === "holding") continue;
      const into = links.filter((l) => l.target === i).reduce((t, l) => t + l.value, 0);
      expect(into).toBeCloseTo(nodes[i].value);
      if (nodes[i].kind === "category") expect(links.filter((l) => l.source === i).reduce((t, l) => t + l.value, 0)).toBeCloseTo(nodes[i].value);
    }
  });
  it("still carries the real income of each category and of the total for the labels and tooltips", () => {
    const r = income([...many("Equities", 5), ...many("Fixed Income", 4), pos("VNQ", "Alternatives", 100, 90, 3.6)]);
    const { nodes } = incomeFlow(r);
    const equities = nodes.find((n) => n.name === "Equities")!;
    expect(equities.amount).toBeCloseTo(r.categories[0].income.expected);
    expect(equities.range).toEqual(r.categories[0].income);
    expect(equities.value).toBeLessThan(equities.amount!); // only its top 3 are drawn
    const total = nodes.find((n) => n.kind === "total")!;
    expect(total.amount).toBeCloseTo(r.total.expected);
    expect(total.range).toEqual(r.total);
  });
  it("a category with 3 or fewer paying holdings is drawn at its full size", () => {
    const { nodes } = incomeFlow(income(many("Equities", 3)));
    const eq = nodes.find((n) => n.name === "Equities")!;
    expect(eq.value).toBeCloseTo(eq.amount!);
  });
  it("is empty when nothing pays income", () => {
    expect(incomeFlow(income([pos("GLD", "Alternatives", 10, 300, 0)]))).toEqual({ nodes: [], links: [] });
    expect(incomeFlow(income([], 100))).toEqual({ nodes: [], links: [] });
  });
});
