import { describe, expect, it } from "vitest";
import type { EtfBreakdown } from "@/lib/portfolio/types";
import { GAP_MAX_PER_RUN, gapsDue } from "./gaps";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const h = (ticker: string, assetClass: string, sector: string | null = null) => ({ ticker, name: `${ticker} Co`, assetClass: assetClass as "Equities", sector });
const bd = (status: "ok" | "none", o: Partial<EtfBreakdown> = {}): EtfBreakdown => ({ sectors: status === "ok" ? [{ name: "Energy", weight: 1 }] : [], countries: [], updatedAt: ago(1), status, ...o });
const due = (holdings: ReturnType<typeof h>[], breakdowns: Record<string, EtfBreakdown> = {}, tries: Record<string, string> = {}) => gapsDue(holdings, breakdowns, {}, tries, [], now);

describe("gapsDue: stocks with no sector", () => {
  it("lists a stock with a blank sector, once", () => {
    expect(due([h("aapl", "Equities"), h("AAPL", "Equities")]).sectors).toEqual([{ ticker: "AAPL", name: "aapl Co" }]);
  });
  it("skips stocks that have a sector, ETFs, bonds and alternatives", () => {
    expect(due([h("A", "Equities", "Energy"), h("V", "Equities", "Diversified"), h("B", "Fixed Income"), h("G", "Alternatives")]).sectors).toEqual([]);
  });
  it("does not ask again within a week of a try, then asks again", () => {
    expect(due([h("A", "Equities")], {}, { A: ago(3) }).sectors).toEqual([]);
    expect(due([h("A", "Equities")], {}, { A: ago(8) }).sectors).toHaveLength(1);
  });
});

describe("gapsDue: equity ETFs without sector weights", () => {
  const etf = h("ETF", "Equities", "Diversified");
  it("is not due before the market data has answered (no record yet)", () => {
    expect(due([etf]).funds).toEqual([]);
  });
  it("is due when the market data answered with nothing", () => {
    expect(due([etf], { ETF: bd("none") }).funds.map((f) => f.ticker)).toEqual(["ETF"]);
  });
  it("is due when the record has countries but no sectors", () => {
    expect(due([etf], { ETF: { ...bd("ok"), sectors: [], countries: [{ code: "US", weight: 1 }] } }).funds).toHaveLength(1);
  });
  it("is not due when it has sector weights, whoever read them", () => {
    expect(due([etf], { ETF: bd("ok") }).funds).toEqual([]);
    expect(due([etf], { ETF: bd("ok", { source: "claude" }) }).funds).toEqual([]);
  });
  it("after Claude found nothing, waits a week before asking again", () => {
    expect(due([etf], { ETF: bd("none", { source: "claude", updatedAt: ago(3) }) }).funds).toEqual([]);
    expect(due([etf], { ETF: bd("none", { source: "claude", updatedAt: ago(8) }) }).funds).toHaveLength(1);
  });
});

describe("gapsDue: bond funds and the cap", () => {
  it("lists bond funds with no duration (the v1.4 rule)", () => {
    expect(due([h("EMBX", "Fixed Income")]).durations.map((d) => d.ticker)).toEqual(["EMBX"]);
  });
  it("looks up only a few of each kind per run", () => {
    const many = Array.from({ length: GAP_MAX_PER_RUN + 4 }, (_, i) => h(`S${i}`, "Equities"));
    expect(due(many).sectors).toHaveLength(GAP_MAX_PER_RUN);
  });
});
