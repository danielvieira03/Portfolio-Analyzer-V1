import { describe, expect, it } from "vitest";
import { matchColumns } from "@/lib/import/columns";
import { parseImportRows } from "@/lib/import/normalize";
import { classify, lotKey, type ExistingLot } from "./import-preview";

const headers = ["Ticker", "Name", "Asset Class", "Shares", "Cost", "Price"];
const rows = [
  { Ticker: "AAPL", Name: "Apple", "Asset Class": "Equities", Shares: "10", Cost: "100", Price: "120" },
  { Ticker: "MSFT", Name: "Microsoft", "Asset Class": "Equities", Shares: "5", Cost: "200", Price: "250" },
];
const parsed = parseImportRows(rows, headers, { columns: matchColumns(headers), headerRow: 1 });
const aapl: ExistingLot = { assetClass: "Equities", ticker: "AAPL", name: "Apple", sector: null, shares: 10, costBasisPerShare: 80 };
const existing = new Map([[lotKey("Equities", "AAPL"), aapl]]);

describe("classify repeated tickers", () => {
  it("flags repeats in add mode and keeps them by default", () => {
    const v = classify(parsed, existing, "add", new Set());
    expect(v.counts.duplicates).toBe(1);
    expect(v.holdings.map((h) => h.ticker)).toEqual(["AAPL", "MSFT"]);
  });
  it("leaves out repeats the user unticked", () => {
    const v = classify(parsed, existing, "add", new Set([lotKey("Equities", "AAPL")]));
    expect(v.counts.leftOut).toBe(1);
    expect(v.holdings.map((h) => h.ticker)).toEqual(["MSFT"]);
  });
  it("flags nothing when replacing the whole portfolio", () => {
    const v = classify(parsed, existing, "replace", new Set());
    expect(v.counts.duplicates).toBe(0);
    expect(v.holdings).toHaveLength(2);
  });
});
