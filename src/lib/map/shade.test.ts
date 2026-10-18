import { describe, expect, it } from "vitest";
import { FAINTEST, exposureOpacity } from "./shade";

describe("exposureOpacity", () => {
  it("is full amber for the biggest exposure and 0 (not coloured) for none", () => {
    expect(exposureOpacity(0.7, 0.7)).toBe(1);
    expect(exposureOpacity(0, 0.7)).toBe(0);
    expect(exposureOpacity(-1, 0.7)).toBe(0);
    expect(exposureOpacity(0.5, 0)).toBe(0);
  });
  it("gets stronger as the exposure grows", () => {
    const o = [0.01, 0.05, 0.2, 0.5, 0.7].map((w) => exposureOpacity(w, 0.7));
    expect([...o].sort((a, b) => a - b)).toEqual(o);
    expect(new Set(o).size).toBe(o.length);
  });
  it("keeps small exposures visible: never fainter than the floor, and 1% next to 70% is clearly lifted", () => {
    expect(exposureOpacity(0.0001, 0.7)).toBeGreaterThanOrEqual(FAINTEST);
    expect(exposureOpacity(0.01, 0.7)).toBeGreaterThan(0.4);
  });
  it("is gentler on small exposures than a straight line would be (square-root scale)", () => {
    const linear = FAINTEST + (1 - FAINTEST) * (0.05 / 0.7);
    expect(exposureOpacity(0.05, 0.7)).toBeGreaterThan(linear);
  });
  it("never goes above 1", () => {
    expect(exposureOpacity(0.9, 0.7)).toBe(1);
  });
});
