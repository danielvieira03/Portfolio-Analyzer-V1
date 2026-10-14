import { describe, expect, it } from "vitest";
import { matchColumns } from "./columns";
import { parseImportRows, parseNumber } from "./normalize";

describe("matchColumns", () => {
  it("matches flexible header names", () => {
    const m = matchColumns(["Symbol", "Qty", "Avg Cost", "Last Price", "Asset Class", "Sector"]);
    expect(m).toEqual({ ticker: "Symbol", shares: "Qty", cost: "Avg Cost", price: "Last Price", assetClass: "Asset Class", sector: "Sector" });
  });
});

describe("parseNumber", () => {
  it("handles currency text and blanks", () => {
    expect(parseNumber("$1,234.50")).toBe(1234.5);
    expect(parseNumber(" ")).toBeUndefined();
    expect(parseNumber("abc")).toBeNaN();
  });
});

const headers = ["Ticker", "Name", "Shares", "Cost", "Price", "Asset Class", "Sector"];
const today = new Date("2026-10-13");

describe("parseImportRows", () => {
  it("accepts a clean row", () => {
    const r = parseImportRows(
      [{ Ticker: "aapl", Name: "Apple", Shares: 10, Cost: 150, Price: 200, "Asset Class": "Stock", Sector: "Technology" }],
      headers, today,
    );
    expect(r.rows[0].status).toBe("ok");
    expect(r.rows[0].holding).toMatchObject({ ticker: "AAPL", assetClass: "Equities", sector: "Information Technology" });
  });
  it("warns and fills gaps instead of failing", () => {
    const r = parseImportRows([{ Ticker: "BND", Name: "", Shares: "5", Cost: "$70", Price: "", "Asset Class": "Bond", Sector: "" }], headers, today);
    expect(r.rows[0].status).toBe("warning");
    expect(r.rows[0].holding?.currentPrice).toBe(70);
    expect(r.rows[0].holding?.name).toBe("BND");
  });
  it("flags bad rows as errors and catches duplicates", () => {
    const r = parseImportRows(
      [
        { Ticker: "X", Name: "", Shares: "abc", Cost: 1, Price: 1, "Asset Class": "Equities", Sector: "" },
        { Ticker: "Y", Name: "Why Inc", Shares: 1, Cost: 1, Price: 1, "Asset Class": "Equities", Sector: "" },
        { Ticker: "Y", Name: "Why Inc", Shares: 1, Cost: 1, Price: 1, "Asset Class": "Equities", Sector: "" },
      ],
      headers, today,
    );
    expect(r.rows.map((x) => x.status)).toEqual(["error", "ok", "error"]);
  });
  it("turns cash rows into a cash amount", () => {
    const r = parseImportRows([{ Ticker: "USD", Name: "", Shares: 2500, Cost: "", Price: "", "Asset Class": "Cash", Sector: "" }], headers, today);
    expect(r.rows[0].cashAmount).toBe(2500);
  });
  it("reports missing required columns", () => {
    const r = parseImportRows([{ Foo: 1 }], ["Foo"], today);
    expect(r.missingRequired).toContain("Ticker / Symbol");
  });
});
