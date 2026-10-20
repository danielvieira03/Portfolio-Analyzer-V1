import { describe, expect, it } from "vitest";
import { displayDuration, durationBandIndex, durationType } from "./duration";

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
