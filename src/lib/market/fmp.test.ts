import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfiles } from "./fmp";

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
