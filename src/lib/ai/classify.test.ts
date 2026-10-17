import { describe, expect, it } from "vitest";

// classify.ts pulls in the server-only Claude client, so the SDK is stubbed; only the pure helpers run here.
import { vi } from "vitest";
vi.mock("./claude", () => ({ AiError: class extends Error {}, getClient: () => null, toAiError: (e: unknown) => e }));

import { checkSubtype, classifyKey } from "./classify";

describe("checkSubtype", () => {
  it("keeps allowed values", () => {
    expect(checkSubtype("Fixed Income", "Short-term")).toBe("Short-term");
    expect(checkSubtype("Alternatives", "REITs")).toBe("REITs");
  });
  it("replaces anything else with the unknown value for that class", () => {
    expect(checkSubtype("Fixed Income", "Intermediate")).toBe("Not specified");
    expect(checkSubtype("Fixed Income", "REITs")).toBe("Not specified");
    expect(checkSubtype("Alternatives", "Short-term")).toBe("Other");
  });
});

describe("classifyKey", () => {
  it("joins class and ticker", () => {
    expect(classifyKey("Fixed Income", "BND")).toBe("Fixed Income:BND");
  });
});
