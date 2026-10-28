import { describe, expect, it } from "vitest";
import { addUsage, estimateCost, noUsage } from "./cost";

const prices = { inputPerMillion: 3, outputPerMillion: 15, cacheWriteFactor: 1.25, cacheReadFactor: 0.1, perSearch: 0.01 };

describe("estimateCost", () => {
  it("is zero for nothing", () => {
    expect(estimateCost(noUsage(), prices)).toBe(0);
  });
  it("prices input, output and searches (the 1-search probe: 13,191 in / 318 out is about 5 cents)", () => {
    const c = estimateCost({ ...noUsage(), inputTokens: 13_191, outputTokens: 318, searches: 1 }, prices);
    expect(c).toBeCloseTo(0.0396 + 0.0048 + 0.01, 3);
  });
  it("charges cache writes more and cache reads far less than normal input", () => {
    expect(estimateCost({ ...noUsage(), cacheWriteTokens: 1_000_000 }, prices)).toBeCloseTo(3.75);
    expect(estimateCost({ ...noUsage(), cacheReadTokens: 1_000_000 }, prices)).toBeCloseTo(0.3);
  });
});

describe("addUsage", () => {
  it("adds every field", () => {
    const a = { inputTokens: 1, outputTokens: 2, cacheWriteTokens: 3, cacheReadTokens: 4, searches: 1 };
    expect(addUsage(a, a)).toEqual({ inputTokens: 2, outputTokens: 4, cacheWriteTokens: 6, cacheReadTokens: 8, searches: 2 });
  });
});
