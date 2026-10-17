import { describe, expect, it } from "vitest";
import { displayScore, riskLabel, riskPosition, riskScore } from "./risk";
import type { AllocationSlice } from "./calc";
import type { AssetClass } from "./types";

const slice = (assetClass: AssetClass, weight: number): AllocationSlice => ({ assetClass, weight, value: weight * 1000 });

describe("riskScore", () => {
  it("scores a single-class portfolio at that class's weight", () => {
    expect(riskScore([slice("Equities", 1)])).toBe(5);
    expect(riskScore([slice("Alternatives", 1)])).toBe(3.5);
    expect(riskScore([slice("Fixed Income", 1)])).toBe(2);
    expect(riskScore([slice("Cash", 1)])).toBe(1);
  });
  it("adds each class's share times its weight", () => {
    // 60% equities, 20% bonds, 10% alternatives, 10% cash = 3.0 + 0.4 + 0.35 + 0.1
    const mix = [slice("Equities", 0.6), slice("Fixed Income", 0.2), slice("Alternatives", 0.1), slice("Cash", 0.1)];
    expect(riskScore(mix)).toBeCloseTo(3.85);
  });
  it("is null for an empty portfolio", () => {
    expect(riskScore([])).toBeNull();
    expect(riskScore([slice("Cash", 0)])).toBeNull();
  });
});

describe("riskLabel", () => {
  it.each([
    [1, "Conservative"],
    [1.4, "Conservative"],
    [1.5, "Moderately Conservative"],
    [2.4, "Moderately Conservative"],
    [3, "Moderate"],
    [3.4, "Moderate"],
    [3.44, "Moderate"],
    [3.46, "Moderately Aggressive"], // shows as 3.5, so it reads Moderately Aggressive
    [3.5, "Moderately Aggressive"],
    [3.6, "Moderately Aggressive"],
    [4.4, "Moderately Aggressive"],
    [4.5, "Aggressive"],
    [5, "Aggressive"],
  ])("score %s is %s", (score, label) => {
    expect(riskLabel(score)).toBe(label);
  });
});

describe("meter helpers", () => {
  it("rounds the displayed score to one decimal", () => {
    expect(displayScore(3.46)).toBe(3.5);
    expect(displayScore(3.84)).toBe(3.8);
  });
  it("places the marker along the 1–5 scale", () => {
    expect(riskPosition(1)).toBe(0);
    expect(riskPosition(3)).toBe(0.5);
    expect(riskPosition(5)).toBe(1);
  });
});
