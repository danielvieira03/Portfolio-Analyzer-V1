import { describe, expect, it } from "vitest";
import type { FundRecord } from "./library";
import { DURATION_MAX_PER_RUN, durationsDue, fundDurations } from "./duration";

const bond = (ticker: string, name = ticker) => ({ ticker, name, assetClass: "Fixed Income" as const });
const fund = (ticker: string, durationYears: number | null, assetClass = "Fixed Income"): FundRecord => ({ ticker, name: ticker, assetClass, subtype: "Medium-term", durationYears });
const now = new Date("2026-10-20T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("fundDurations", () => {
  it("takes the library first, then the durations looked up one by one", () => {
    const out = fundDurations([bond("BND"), bond("emb"), bond("XYZ")], [fund("BND", 5.7)], { EMB: { years: 6.3, checkedAt: ago(1) }, BND: { years: 9, checkedAt: ago(1) } });
    expect(out).toEqual({ BND: 5.7, EMB: 6.3 });
  });
  it("ignores a library record with no duration, 'tried, none found' records, other asset classes and non-bond holdings", () => {
    const out = fundDurations(
      [bond("AAA"), bond("BBB"), { ticker: "GLD", assetClass: "Alternatives" }, { ticker: "VOO", assetClass: "Equities" }],
      [fund("AAA", null), fund("GLD", 3, "Alternatives")],
      { BBB: { years: null, checkedAt: ago(1) } },
    );
    expect(out).toEqual({});
  });
});

describe("durationsDue", () => {
  it("lists bond funds with no duration, once each, upper-case", () => {
    const due = durationsDue([bond("emb", "EM Bond"), bond("EMB"), bond("BND")], [fund("BND", 5.7)], {}, now);
    expect(due).toEqual([{ ticker: "EMB", name: "EM Bond", assetClass: "Fixed Income" }]);
  });
  it("skips funds that already have a duration, and holdings that are not bond funds", () => {
    expect(durationsDue([bond("BND"), { ticker: "VOO", name: "VOO", assetClass: "Equities" }], [fund("BND", 5.7)], {}, now)).toEqual([]);
    expect(durationsDue([bond("EMB")], [], { EMB: { years: 6.3, checkedAt: ago(30) } }, now)).toEqual([]);
  });
  it("does not ask again within a week of a try that found nothing, then asks again", () => {
    expect(durationsDue([bond("XYZ")], [], { XYZ: { years: null, checkedAt: ago(3) } }, now)).toEqual([]);
    expect(durationsDue([bond("XYZ")], [], { XYZ: { years: null, checkedAt: ago(8) } }, now).map((d) => d.ticker)).toEqual(["XYZ"]);
  });
  it("asks about a fund whose library record has no duration", () => {
    expect(durationsDue([bond("AAA")], [fund("AAA", null)], {}, now).map((d) => d.ticker)).toEqual(["AAA"]);
  });
  it("looks up at most a few funds per run", () => {
    const many = Array.from({ length: DURATION_MAX_PER_RUN + 5 }, (_, i) => bond(`F${i}`));
    expect(durationsDue(many, [], {}, now)).toHaveLength(DURATION_MAX_PER_RUN);
  });
});
