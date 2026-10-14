import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "./format";

describe("format", () => {
  it("formats whole-dollar currency", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,568");
  });
  it("shows the sign on gains and losses", () => {
    expect(formatSignedCurrency(2500)).toBe("+$2,500");
    expect(formatSignedCurrency(-2500)).toBe("-$2,500");
    expect(formatSignedPercent(0.1234)).toBe("+12.34%");
    expect(formatSignedPercent(-0.05)).toBe("-5.00%");
  });
  it("formats percents from fractions", () => {
    expect(formatPercent(0.25)).toBe("25.00%");
  });
});
