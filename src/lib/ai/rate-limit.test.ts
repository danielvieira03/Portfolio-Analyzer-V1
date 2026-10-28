import { describe, expect, it } from "vitest";
import { checkLimit, limitMessage } from "./rate-limit";

const MIN = 60_000;

describe("checkLimit", () => {
  it("allows questions up to the limit and counts each one", () => {
    let stamps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = checkLimit(stamps, i * MIN, 5);
      expect(r.allowed).toBe(true);
      stamps = r.stamps;
    }
    expect(stamps).toHaveLength(5);
  });
  it("refuses the next one and says when the oldest question leaves the window", () => {
    const r = checkLimit([0, MIN, 2 * MIN, 3 * MIN, 4 * MIN], 10 * MIN, 5);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(50 * MIN);
    expect(r.stamps).toHaveLength(5); // a refused question is not counted
  });
  it("lets questions through again once old ones are over an hour old", () => {
    const r = checkLimit([0, MIN, 2 * MIN, 3 * MIN, 4 * MIN], 61 * MIN, 5);
    expect(r.allowed).toBe(true);
    expect(r.stamps).toEqual([2 * MIN, 3 * MIN, 4 * MIN, 61 * MIN]);
  });
  it("ignores stamps from the future (a changed clock)", () => {
    expect(checkLimit([999 * MIN, 999 * MIN, 999 * MIN, 999 * MIN, 999 * MIN], 0, 5).allowed).toBe(true);
  });
});

describe("limitMessage", () => {
  it("is friendly", () => {
    expect(limitMessage(5)).toBe("You hit your 5 question limit for the hour. Try again in a few moments.");
  });
});
