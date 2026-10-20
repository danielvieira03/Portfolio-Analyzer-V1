import { describe, expect, it } from "vitest";
import { sectorWeightsFromPercents } from "./claude-breakdown";

const rows = (...r: [string, number][]) => r.map(([sector, percent]) => ({ sector, percent }));

describe("sectorWeightsFromPercents", () => {
  it("turns percentages into fractions in the app's sector names, biggest first", () => {
    const w = sectorWeightsFromPercents(rows(["Financials", 30], ["Energy", 40], ["Technology", 25]))!;
    expect(w.map((x) => x.name)).toEqual(["Energy", "Financials", "Information Technology"]);
    expect(w[0].weight).toBeCloseTo(0.4);
  });
  it("adds repeated sectors and ignores Diversified, unknown names and unusable numbers", () => {
    const w = sectorWeightsFromPercents(rows(["Energy", 50], ["energy", 20], ["Diversified", 20], ["Crypto", 30], ["Utilities", -4], ["Materials", 25]))!;
    expect(w.find((x) => x.name === "Energy")!.weight).toBeCloseTo(0.7);
    expect(w.map((x) => x.name).sort()).toEqual(["Energy", "Materials"]);
  });
  it("accepts a total a little under 100% (cash, rounding) and scales one a little over back to 100%", () => {
    expect(sectorWeightsFromPercents(rows(["Energy", 92]))![0].weight).toBeCloseTo(0.92);
    const over = sectorWeightsFromPercents(rows(["Energy", 60], ["Materials", 45]))!;
    expect(over.reduce((t, x) => t + x.weight, 0)).toBeCloseTo(1);
  });
  it("rejects an answer that is not believable", () => {
    expect(sectorWeightsFromPercents([])).toBeNull();
    expect(sectorWeightsFromPercents(rows(["Energy", 60]))).toBeNull(); // 60% total
    expect(sectorWeightsFromPercents(rows(["Energy", 80], ["Materials", 40]))).toBeNull(); // 120% total
    expect(sectorWeightsFromPercents(rows(["Nonsense", 100]))).toBeNull();
  });
});
