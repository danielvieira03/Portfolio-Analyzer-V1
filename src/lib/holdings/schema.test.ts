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
  it("accepts a maturity on bonds and a type on alternatives, and treats blank as not set", () => {
    const bond = { ...valid, assetClass: "Fixed Income", sector: null };
    expect(holdingSchema.safeParse({ ...bond, subtype: "Long-term" }).success).toBe(true);
    expect(holdingSchema.safeParse({ ...bond, subtype: "Not specified" }).success).toBe(true);
    expect(holdingSchema.safeParse({ ...bond, assetClass: "Alternatives", subtype: "REITs" }).success).toBe(true);
    const blank = holdingSchema.safeParse({ ...bond, subtype: "" });
    expect(blank.success && blank.data.subtype).toBe(null);
    const missing = holdingSchema.safeParse(bond);
    expect(missing.success && missing.data.subtype).toBe(null);
  });
  it("rejects a maturity that is not on the list, a bond maturity on an alternative, or any value on equities", () => {
    const bond = { ...valid, assetClass: "Fixed Income", sector: null };
    expect(holdingSchema.safeParse({ ...bond, subtype: "Forever" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...bond, assetClass: "Alternatives", subtype: "Long-term" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...valid, subtype: "Long-term" }).success).toBe(false);
  });
  it("rejects a missing ticker or bad characters", () => {
    expect(holdingSchema.safeParse({ ...valid, ticker: "" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...valid, ticker: "A B" }).success).toBe(false);
  });
});
