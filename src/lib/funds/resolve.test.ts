import { describe, expect, it, vi } from "vitest";
import type { FundItem, FundRecord } from "./library";
import { resolveSubtypes, type ClaudeLookup, type ResolveDeps } from "./resolve";

const usage = { inputTokens: 10, outputTokens: 5 };
const rec = (ticker: string, assetClass: string, subtype: string): FundRecord => ({ ticker, name: ticker, assetClass, subtype, durationYears: null });
const item = (ticker: string, assetClass: FundItem["assetClass"]): FundItem => ({ ticker, name: `${ticker} Fund`, assetClass });

function deps(library: FundRecord[], claude: Partial<ClaudeLookup> = {}) {
  const lookup = vi.fn(async (items: FundItem[]): Promise<ClaudeLookup> => (void items, ({ found: {}, durations: {}, usage, searches: 3, ...claude })));
  const save = vi.fn(async (funds: FundRecord[]) => void funds);
  const d: ResolveDeps = { getLibrary: async () => library, lookup, save };
  return { d, lookup, save };
}

describe("resolveSubtypes", () => {
  it("never calls Claude when every fund is in the library", async () => {
    const { d, lookup, save } = deps([rec("BND", "Fixed Income", "Medium-term"), rec("GLD", "Alternatives", "Commodities")]);
    const r = await resolveSubtypes([item("BND", "Fixed Income"), item("GLD", "Alternatives")], d);
    expect(r.found).toEqual({ "Fixed Income:BND": "Medium-term", "Alternatives:GLD": "Commodities" });
    expect(r).toMatchObject({ fromLibrary: 2, searched: 0, searches: 0 });
    expect(lookup).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("asks Claude only about unknown funds and saves its answers with the duration", async () => {
    const { d, lookup, save } = deps([rec("BND", "Fixed Income", "Medium-term")], {
      found: { "Fixed Income:MUB": "Long-term", "Alternatives:XYZ": "Other" },
      durations: { "Fixed Income:MUB": 6.3 },
    });
    const r = await resolveSubtypes([item("BND", "Fixed Income"), item("MUB", "Fixed Income"), item("XYZ", "Alternatives")], d);
    expect(lookup.mock.calls[0][0].map((i) => i.ticker)).toEqual(["MUB", "XYZ"]);
    expect(r.found).toEqual({ "Fixed Income:BND": "Medium-term", "Fixed Income:MUB": "Long-term", "Alternatives:XYZ": "Other" });
    expect(r).toMatchObject({ fromLibrary: 1, searched: 2, searches: 3 });
    expect(save).toHaveBeenCalledWith([
      { ticker: "MUB", name: "MUB Fund", assetClass: "Fixed Income", subtype: "Long-term", durationYears: 6.3 },
      { ticker: "XYZ", name: "XYZ Fund", assetClass: "Alternatives", subtype: "Other", durationYears: null },
    ]);
  });

  it("does not save a bond fund Claude called 'Not specified', but still returns it", async () => {
    const { d, save } = deps([], { found: { "Fixed Income:ODD": "Not specified" } });
    const r = await resolveSubtypes([item("ODD", "Fixed Income")], d);
    expect(r.found["Fixed Income:ODD"]).toBe("Not specified");
    expect(save).not.toHaveBeenCalled();
  });

  it("leaves out funds Claude gave no answer for", async () => {
    const { d, save } = deps([], { found: {} });
    const r = await resolveSubtypes([item("NOPE", "Alternatives")], d);
    expect(r.found).toEqual({});
    expect(save).not.toHaveBeenCalled();
  });

  it("treats a library fund of another asset class as unknown", async () => {
    const { d, lookup } = deps([rec("GLD", "Alternatives", "Commodities")], { found: { "Fixed Income:GLD": "Not specified" } });
    await resolveSubtypes([item("GLD", "Fixed Income")], d);
    expect(lookup).toHaveBeenCalledOnce();
  });

  it("keeps the library answer and the Claude error separate: a failing lookup throws and saves nothing", async () => {
    const save = vi.fn();
    const d: ResolveDeps = { getLibrary: async () => [], lookup: async () => { throw new Error("boom"); }, save };
    await expect(resolveSubtypes([item("X", "Fixed Income")], d)).rejects.toThrow("boom");
    expect(save).not.toHaveBeenCalled();
  });
});
