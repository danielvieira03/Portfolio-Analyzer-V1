import { describe, expect, it } from "vitest";
import { displayDuration, durationBandIndex, durationType, topContributors } from "./duration";

describe("durationType", () => {
  it("under 1 year is ultra-short", () => {
    expect(durationType(0.11)).toBe("Ultra-Short Duration");
    expect(durationType(0.94)).toBe("Ultra-Short Duration");
  });
  it("1 up to 3 is short", () => {
    expect(durationType(1)).toBe("Short Duration");
    expect(durationType(2.9)).toBe("Short Duration");
  });
  it("3 up to 7 is intermediate", () => {
    expect(durationType(3)).toBe("Intermediate Duration");
    expect(durationType(5.12)).toBe("Intermediate Duration");
    expect(durationType(6.9)).toBe("Intermediate Duration");
  });
  it("7 and over is long", () => {
    expect(durationType(7)).toBe("Long Duration");
    expect(durationType(14.85)).toBe("Long Duration");
  });
  it("uses the number as shown (one decimal), so the number and the label never disagree", () => {
    expect(displayDuration(2.96)).toBe(3);
    expect(durationType(2.96)).toBe("Intermediate Duration"); // shows 3.0
    expect(durationType(6.96)).toBe("Long Duration"); // shows 7.0
    expect(durationType(0.96)).toBe("Short Duration"); // shows 1.0
    expect(durationType(2.94)).toBe("Short Duration"); // shows 2.9
  });
  it("gives the band position", () => {
    expect([0.5, 2, 5, 9].map(durationBandIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe("topContributors", () => {
  const row = (ticker: string, value: number, years: number, total: number) => ({ ticker, name: ticker, value, years, weight: value / total, contribution: (years * value) / total });
  const view = (rows: ReturnType<typeof row>[]) => ({ rows, average: rows.reduce((t, r) => t + r.contribution, 0) || null });
  const seven = [row("A", 30, 0.1, 100), row("B", 25, 5.7, 100), row("C", 15, 14.9, 100), row("D", 10, 2.7, 100), row("E", 8, 6.2, 100), row("F", 7, 1.8, 100), row("G", 5, 6.4, 100)];

  it("ranks by what a fund adds to the average, not by its size", () => {
    const top = topContributors(view(seven));
    expect(top.map((t) => t.ticker)).toEqual(["C", "B", "E", "G", "D"]); // C is 15% of the money but adds the most
  });
  it("shows only the top 5, or all of them when there are fewer", () => {
    expect(topContributors(view(seven))).toHaveLength(5);
    expect(topContributors(view(seven.slice(0, 3)))).toHaveLength(3);
    expect(topContributors(view(seven), 3)).toHaveLength(3);
  });
  it("gives each fund's share of the average, adding up to 100% when all are shown", () => {
    const all = topContributors(view(seven), 10);
    expect(all.reduce((t, c) => t + c.shareOfDuration, 0)).toBeCloseTo(1);
    expect(all[0].shareOfDuration).toBeCloseTo(0.15 * 14.9 / (view(seven).average ?? 1));
  });
  it("breaks ties by the bigger holding, then the ticker", () => {
    const tie = topContributors(view([row("Z", 20, 5, 100), row("Y", 50, 2, 100), row("X", 20, 5, 100)]));
    expect(tie.map((t) => t.ticker)).toEqual(["Y", "X", "Z"]); // Y and X/Z all add 1.0; Y is biggest, then X before Z
  });
  it("is empty when there is nothing to show", () => {
    expect(topContributors({ rows: [], average: null })).toEqual([]);
  });
});
