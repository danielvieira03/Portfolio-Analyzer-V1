import { describe, expect, it } from "vitest";
import { fieldErrors, holdingSchema } from "./schema";

const valid = {
  ticker: " aapl ", name: "Apple Inc.", assetClass: "Equities", sector: "Information Technology",
  shares: 10, costBasisPerShare: 150, currentPrice: 200, priceAsOf: "2026-10-01",
};

describe("holdingSchema", () => {
  it("accepts a valid holding and cleans the ticker", () => {
    const r = holdingSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ticker).toBe("AAPL");
  });
  it("rejects zero shares and negative prices", () => {
    const r = holdingSchema.safeParse({ ...valid, shares: 0, currentPrice: -1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error))).toEqual(["shares", "currentPrice"]);
  });
  it("only allows a sector on equities", () => {
    const r = holdingSchema.safeParse({ ...valid, assetClass: "Fixed Income" });
    expect(r.success).toBe(false);
  });
  it("allows equities and bonds without a sector", () => {
    expect(holdingSchema.safeParse({ ...valid, sector: null }).success).toBe(true);
    expect(holdingSchema.safeParse({ ...valid, assetClass: "Fixed Income", sector: null }).success).toBe(true);
  });
  it("rejects a missing ticker or bad characters", () => {
    expect(holdingSchema.safeParse({ ...valid, ticker: "" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...valid, ticker: "A B" }).success).toBe(false);
  });
});
