import { describe, expect, it } from "vitest";
import { matchColumns, missingRequired } from "./columns";
import { parseImportRows, parseNumber } from "./normalize";
import { matrixToTable, parseDelimited, sniffDelimiter } from "./table";

describe("matchColumns", () => {
  it("matches flexible header names", () => {
    const m = matchColumns(["Symbol", "Qty", "Avg Cost", "Last Price", "Asset Class", "Sector"]);
    expect(m.columns).toEqual({ ticker: "Symbol", shares: "Qty", cost: "Avg Cost", price: "Last Price", assetClass: "Asset Class", sector: "Sector" });
    expect(m.costAmbiguous).toBe(false);
  });
  it("understands wordier headers", () => {
    const m = matchColumns(["Stock Symbol", "Shares Owned", "Total Cost Basis", "Current Market Price", "Market Value"]);
    expect(m.columns).toMatchObject({ ticker: "Stock Symbol", shares: "Shares Owned", costTotal: "Total Cost Basis", price: "Current Market Price", value: "Market Value" });
  });
  it("flags a plain 'Cost' column as ambiguous", () => {
    const m = matchColumns(["Ticker", "Shares", "Cost", "Price", "Value"]);
    expect(m.columns.cost).toBe("Cost");
    expect(m.costAmbiguous).toBe(true);
    expect(m.columns.value).toBe("Value");
  });
  it("does not mistake 'Cost per share' for the share count", () => {
    expect(matchColumns(["Ticker", "Cost per share", "Quantity"]).columns).toMatchObject({ cost: "Cost per share", shares: "Quantity" });
  });
  it("reports what is missing", () => {
    expect(missingRequired(matchColumns(["Foo"]).columns)).toContain("Ticker / Symbol");
    expect(missingRequired(matchColumns(["Ticker", "Value", "Price"]).columns)).toEqual([]); // shares can be derived
  });
});

describe("parseNumber", () => {
  it("handles currency text and blanks", () => {
    expect(parseNumber("$1,234.50")).toBe(1234.5);
    expect(parseNumber(" ")).toBeUndefined();
    expect(parseNumber("abc")).toBeNaN();
  });
});

describe("table reading", () => {
  it("detects semicolon-separated files and strips the BOM", () => {
    const text = "﻿Ticker;Shares;Cost;Price\nAAPL;10;150;200\n";
    expect(sniffDelimiter(text)).toBe(";");
    expect(parseDelimited(text)).toEqual([["Ticker", "Shares", "Cost", "Price"], ["AAPL", "10", "150", "200"]]);
  });
  it("keeps commas inside quotes", () => {
    expect(parseDelimited('Ticker,Name\nA,"Smith, Inc"\n')[1]).toEqual(["A", "Smith, Inc"]);
  });
  it("skips title rows above the real headers", () => {
    const t = matrixToTable([
      ["My Portfolio", "", ""],
      ["Exported 2026-10-14", "", ""],
      ["", "", ""],
      ["Ticker", "Qty", "Price"],
      ["AAPL", 10, 200],
    ]);
    expect(t.headers).toEqual(["Ticker", "Qty", "Price"]);
    expect(t.rows).toEqual([{ Ticker: "AAPL", Qty: 10, Price: 200 }]);
    expect(t.headerRow).toBe(4);
  });
});

const headers = ["Ticker", "Name", "Shares", "Cost", "Price", "Asset Class", "Sector"];
const today = new Date("2026-10-13");
const opts = { today };

describe("parseImportRows", () => {
  it("accepts a clean row", () => {
    const r = parseImportRows(
      [{ Ticker: "aapl", Name: "Apple", Shares: 10, Cost: 150, Price: 200, "Asset Class": "Stock", Sector: "Technology" }],
      headers, opts,
    );
    expect(r.rows[0].status).toBe("ok");
    expect(r.rows[0].holding).toMatchObject({ ticker: "AAPL", assetClass: "Equities", sector: "Information Technology" });
  });
  it("warns and fills gaps instead of failing", () => {
    const r = parseImportRows([{ Ticker: "BND", Name: "", Shares: "5", Cost: "$70", Price: "", "Asset Class": "Bond", Sector: "" }], headers, opts);
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
      headers, opts,
    );
    expect(r.rows.map((x) => x.status)).toEqual(["error", "ok", "error"]);
  });
  it("turns cash rows into a cash amount", () => {
    const r = parseImportRows([{ Ticker: "USD", Name: "", Shares: 2500, Cost: "", Price: "", "Asset Class": "Cash", Sector: "" }], headers, opts);
    expect(r.rows[0].cashAmount).toBe(2500);
  });
  it("reports missing required columns", () => {
    const r = parseImportRows([{ Foo: 1 }], ["Foo"], opts);
    expect(r.missingRequired).toContain("Ticker / Symbol");
  });
  it("works out shares from value ÷ price when there is no shares column", () => {
    const r = parseImportRows(
      [{ Ticker: "AAPL", Cost: 150, Price: 200, Value: 2000 }],
      ["Ticker", "Cost", "Price", "Value"], opts,
    );
    expect(r.rows[0].holding?.shares).toBeCloseTo(10);
    expect(r.rows[0].status).toBe("warning");
  });
  it("converts a total-cost column to per-share when the data says so", () => {
    const r = parseImportRows(
      [
        { Ticker: "AAPL", Shares: 10, Cost: 1500, Price: 200 },
        { Ticker: "MSFT", Shares: 4, Cost: 1200, Price: 400 },
      ],
      ["Ticker", "Shares", "Cost", "Price"], opts,
    );
    expect(r.rows[0].holding?.costBasisPerShare).toBeCloseTo(150);
    expect(r.rows[1].holding?.costBasisPerShare).toBeCloseTo(300);
  });
  it("keeps a per-share cost column as it is", () => {
    const r = parseImportRows(
      [{ Ticker: "AAPL", Shares: 10, Cost: 150, Price: 200 }, { Ticker: "MSFT", Shares: 4, Cost: 300, Price: 400 }],
      ["Ticker", "Shares", "Cost", "Price"], opts,
    );
    expect(r.rows[0].holding?.costBasisPerShare).toBe(150);
  });
  it("uses an explicit total-cost column", () => {
    const r = parseImportRows([{ Ticker: "AAPL", Shares: 10, "Total Cost": 1500, Price: 200 }], ["Ticker", "Shares", "Total Cost", "Price"], opts);
    expect(r.rows[0].holding?.costBasisPerShare).toBeCloseTo(150);
  });
  it("warns when value disagrees with shares × price", () => {
    const r = parseImportRows([{ Ticker: "AAPL", Shares: 10, Cost: 150, Price: 200, Value: 5000 }], ["Ticker", "Shares", "Cost", "Price", "Value"], opts);
    expect(r.rows[0].messages.join(" ")).toMatch(/doesn't match/);
  });
  it("accepts a manual column mapping", () => {
    const r = parseImportRows(
      [{ "Sym.": "AAPL", "How many": 3, "Paid": 100 }],
      ["Sym.", "How many", "Paid"],
      { ...opts, columns: { columns: { ticker: "Sym.", shares: "How many", cost: "Paid" }, costAmbiguous: false } },
    );
    expect(r.rows[0].holding).toMatchObject({ ticker: "AAPL", shares: 3, costBasisPerShare: 100 });
  });
  it("uses one default asset class instead of per-row warnings when the column is absent", () => {
    const h = ["Ticker", "Shares", "Cost", "Price"];
    const r = parseImportRows([{ Ticker: "BND", Shares: 5, Cost: 70, Price: 72 }], h, { ...opts, defaultAssetClass: "Fixed Income" });
    expect(r.rows[0].status).toBe("ok");
    expect(r.rows[0].holding?.assetClass).toBe("Fixed Income");
  });
  it("passes extra notes through to the preview", () => {
    const r = parseImportRows([{ Ticker: "AAPL", Shares: 1, Cost: 1, Price: 1, __notes: ["Blurry digit"] }], ["Ticker", "Shares", "Cost", "Price"], opts);
    expect(r.rows[0].status).toBe("warning");
    expect(r.rows[0].messages).toContain("Blurry digit");
  });
});
