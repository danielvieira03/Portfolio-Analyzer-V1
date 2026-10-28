import { describe, expect, it } from "vitest";
import { SECTORS } from "@/lib/portfolio/sectors";
import { FALLBACK_BENCHMARK, benchmarkIsDue, checkBenchmark, parseBenchmark, validWeights } from "./benchmark";

// SPY's real answer from the provider (its own sector names), as received on 2026-10-28.
const SPY = [
  ["Technology", 37.57], ["Financial Services", 12.08], ["Healthcare", 9.94], ["Communication Services", 9.23], ["Consumer Cyclical", 8.96],
  ["Industrials", 8.03], ["Consumer Defensive", 4.95], ["Energy", 3.73], ["Utilities", 2.04], ["Real Estate", 1.75], ["Basic Materials", 1.7],
].map(([sector, w]) => ({ sector, weightPercentage: w }));

describe("parseBenchmark", () => {
  it("turns the provider's list into the app's sectors, in percent, dated today", () => {
    const b = parseBenchmark(SPY, "2026-10-28")!;
    expect(b.asOf).toBe("2026-10-28");
    expect(b.weights["Information Technology"]).toBe(37.57);
    expect(b.weights["Financials"]).toBe(12.08);
    expect(b.weights["Health Care"]).toBe(9.94);
    expect(b.weights["Consumer Discretionary"]).toBe(8.96);
    expect(b.weights["Consumer Staples"]).toBe(4.95);
    expect(b.weights["Materials"]).toBe(1.7);
    expect(Object.keys(b.weights).sort()).toEqual([...SECTORS].sort());
  });
  it("accepts weights written as '37.57%' too", () => {
    expect(parseBenchmark(SPY.map((r) => ({ ...r, weightPercentage: `${r.weightPercentage}%` })), "2026-10-28")).not.toBeNull();
  });
  it("is null when a sector is missing, the total is off, or the answer is not a list", () => {
    expect(parseBenchmark(SPY.slice(1), "2026-10-28")).toBeNull();
    expect(parseBenchmark(SPY.map((r) => ({ ...r, weightPercentage: 5 })), "2026-10-28")).toBeNull();
    expect(parseBenchmark({ error: "limit" }, "2026-10-28")).toBeNull();
    expect(parseBenchmark([], "2026-10-28")).toBeNull();
  });
  it("is null for a date that is not YYYY-MM-DD", () => {
    expect(parseBenchmark(SPY, "yesterday")).toBeNull();
  });
});

describe("the built-in fallback", () => {
  it("is itself a valid benchmark", () => {
    expect(validWeights(FALLBACK_BENCHMARK.weights)).toBe(true);
    expect(checkBenchmark(FALLBACK_BENCHMARK)).not.toBeNull();
  });
});

describe("checkBenchmark", () => {
  it("rejects junk from storage", () => {
    expect(checkBenchmark(null)).toBeNull();
    expect(checkBenchmark("x")).toBeNull();
    expect(checkBenchmark({ weights: { Energy: 3 }, asOf: "2026-10-28" })).toBeNull();
    expect(checkBenchmark({ weights: FALLBACK_BENCHMARK.weights, asOf: "soon" })).toBeNull();
  });
});

describe("benchmarkIsDue", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("is due after a week, not before", () => {
    expect(benchmarkIsDue("2026-10-28", now)).toBe(true);
    expect(benchmarkIsDue("2026-10-29", now)).toBe(false);
    expect(benchmarkIsDue("2026-11-04", now)).toBe(false);
  });
  it("is due when the date can't be read", () => {
    expect(benchmarkIsDue("nonsense", now)).toBe(true);
  });
});
