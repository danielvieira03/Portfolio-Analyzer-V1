import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBreakdowns, fetchProfiles } from "./fmp";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const aapl = [{ symbol: "AAPL", companyName: "Apple Inc.", price: 300, sector: "Technology", isEtf: false }];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchProfiles", () => {
  it("reports a missing key without calling the API", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await fetchProfiles(["AAPL"]);
    expect(r.status).toBe("no_key");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns profiles, and null for a ticker with no data", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("AAPL") ? ok(aapl) : ok([]))));
    const r = await fetchProfiles(["AAPL", "ZZZZ"]);
    expect(r.status).toBe("ok");
    expect(r.profiles.get("AAPL")?.price).toBe(300);
    expect(r.profiles.get("ZZZZ")).toBeNull();
  });

  it("treats a 402 on one ticker as 'no price' for that ticker only", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("BND") ? new Response("restricted", { status: 402 }) : ok(aapl))));
    const r = await fetchProfiles(["AAPL", "BND"]);
    expect(r.status).toBe("ok");
    expect(r.profiles.get("BND")).toBeNull();
    expect(r.profiles.get("AAPL")?.price).toBe(300);
  });

  it("stops and reports the usage limit on a 429", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    const spy = vi.fn(async () => new Response("limit", { status: 429 }));
    vi.stubGlobal("fetch", spy);
    const tickers = Array.from({ length: 30 }, (_, i) => `T${i}`);
    const r = await fetchProfiles(tickers);
    expect(r.status).toBe("limit");
    expect(spy.mock.calls.length).toBeLessThan(30); // gave up early
  });

  it("survives network errors by treating tickers as unavailable", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom secret-key"); }));
    const r = await fetchProfiles(["AAPL"]);
    expect(r.status).toBe("unreachable");
    expect(r.profiles.size).toBe(0);
  });
});

describe("fetchBreakdowns", () => {
  const sectors = [{ symbol: "VOO", sector: "Technology", weightPercentage: 38.72 }, { symbol: "VOO", sector: "Energy", weightPercentage: 3.48 }];
  const countries = [{ country: "United States", weightPercentage: "100%" }];
  const now = new Date("2026-10-18T12:00:00Z");
  const eq = (...t: string[]) => t.map((ticker) => ({ ticker, sectors: true }));
  const answer = (map: Record<string, Response | (() => Response)>) =>
    vi.fn(async (url: string) => {
      const hit = Object.entries(map).find(([k]) => url.includes(k));
      const r = hit ? hit[1] : ok([]);
      return typeof r === "function" ? r() : r;
    });

  it("reports a missing key without calling the API", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await fetchBreakdowns(eq("VOO"), now)).status).toBe("no_key");
    expect(spy).not.toHaveBeenCalled();
  });

  it("makes two calls per fund and returns the translated weights", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    const spy = answer({ "sector-weightings": ok(sectors), "country-weightings": ok(countries) });
    vi.stubGlobal("fetch", spy);
    const r = await fetchBreakdowns(eq("VOO"), now);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("ok");
    const b = r.breakdowns.get("VOO")!;
    expect(b.status).toBe("ok");
    expect(b.sectors.map((s) => s.name)).toEqual(["Information Technology", "Energy"]);
    expect(b.countries).toEqual([{ code: "US", weight: 1 }]);
    expect(b.updatedAt).toBe(now.toISOString());
  });

  it("records 'none' for a fund the provider answers with nothing (404 or empty)", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", answer({ "sector-weightings": new Response("", { status: 404 }), "country-weightings": ok([]) }));
    const r = await fetchBreakdowns(eq("XYZ"), now);
    expect(r.status).toBe("ok");
    expect(r.breakdowns.get("XYZ")?.status).toBe("none");
  });

  it("stops on a usage limit and returns what it already had", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    const spy = vi.fn(async () => new Response("limit", { status: 429 }));
    vi.stubGlobal("fetch", spy);
    const r = await fetchBreakdowns(eq(...Array.from({ length: 30 }, (_, i) => `T${i}`)), now);
    expect(r.status).toBe("limit");
    expect(r.breakdowns.size).toBe(0);
    expect(spy.mock.calls.length).toBeLessThan(60);
  });

  it("reports a plan restriction without recording 'no data' (so saved data survives)", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upgrade", { status: 402 })));
    const r = await fetchBreakdowns(eq("VOO", "QQQ"), now);
    expect(r.status).toBe("restricted");
    expect(r.breakdowns.size).toBe(0);
  });

  it("one restricted fund does not block the others", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", answer({ ODD: new Response("x", { status: 403 }), "sector-weightings": ok(sectors), "country-weightings": ok(countries) }));
    const r = await fetchBreakdowns(eq("ODD", "VOO"), now);
    expect(r.status).toBe("ok");
    expect([...r.breakdowns.keys()]).toEqual(["VOO"]);
  });

  it("survives network errors, never recording anything", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom secret-key"); }));
    const r = await fetchBreakdowns(eq("VOO"), now);
    expect(r.status).toBe("unreachable");
    expect(r.breakdowns.size).toBe(0);
  });

  it("skips the sector call for a bond fund (one call) and still saves its countries", async () => {
    vi.stubEnv("FINANCIAL_MODELING_API_KEY", "secret-key");
    const spy = answer({ "country-weightings": ok([{ country: "United States", weightPercentage: "93.29%" }, { country: "Supranational", weightPercentage: "1.41%" }]) });
    vi.stubGlobal("fetch", spy);
    const r = await fetchBreakdowns([{ ticker: "BND", sectors: false }, { ticker: "VOO", sectors: true }], now);
    const urls = spy.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("BND") && u.includes("sector-weightings"))).toHaveLength(0);
    expect(urls.filter((u) => u.includes("BND") && u.includes("country-weightings"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("VOO"))).toHaveLength(2);
    expect(r.breakdowns.get("BND")).toMatchObject({ status: "ok", sectors: [], countries: [{ code: "US", weight: expect.closeTo(0.9329) }] });
  });
});

