import { describe, expect, it } from "vitest";
import { fundDataNote, unclassifiedNote } from "./exposure-notes";

describe("fundDataNote", () => {
  it("says how old the data is and how many funds have none", () => {
    expect(fundDataNote("2026-10-12T08:00:00.000Z", 0)).toBe("Fund data as of Oct 12, 2026.");
    expect(fundDataNote("2026-10-12T08:00:00.000Z", 1)).toBe("Fund data as of Oct 12, 2026. 1 fund has no breakdown data.");
    expect(fundDataNote(null, 2)).toBe("2 funds have no breakdown data.");
  });
  it("is empty when no funds are involved", () => {
    expect(fundDataNote(null, 0)).toBe("");
  });
});

describe("unclassifiedNote", () => {
  it("states the share, naming what is missing", () => {
    expect(unclassifiedNote(0.0834, "country")).toBe("Unclassified: 8.3% of the holdings counted has no country data.");
    expect(unclassifiedNote(0.2, "sector")).toContain("no sector data");
  });
  it("is empty for nothing", () => {
    expect(unclassifiedNote(0, "country")).toBe("");
  });
});
