import { describe, expect, it } from "vitest";
import { parseImportRows } from "@/lib/import/normalize";
import type { Extraction } from "./schema";
import { extractionToTable } from "./to-rows";

const base = { name: null, shares: null, costPerShare: null, totalCost: null, price: null, marketValue: null, assetClass: null, sector: null, confidence: "high" as const, note: null };

describe("extractionToTable", () => {
  it("feeds the importer's checks, including cash and Claude's notes", () => {
    const ex: Extraction = {
      holdings: [
        { ...base, ticker: "AAPL", name: "Apple", shares: 10, costPerShare: 150, price: 200, assetClass: "Equities", sector: "Information Technology" },
        { ...base, ticker: "BND", shares: 100, totalCost: 7500, marketValue: 7300, assetClass: "Fixed Income", confidence: "low", note: "Last digit blurry" },
      ],
      cashAmount: 2500,
      issues: [],
    };
    const { headers, rows } = extractionToTable(ex);
    const parsed = parseImportRows(rows, headers);
    expect(parsed.missingRequired).toEqual([]);
    const [aapl, bnd, cash] = parsed.rows;
    expect(aapl.holding).toMatchObject({ ticker: "AAPL", shares: 10, costBasisPerShare: 150, sector: "Information Technology" });
    expect(bnd.holding?.costBasisPerShare).toBeCloseTo(75); // total cost converted
    expect(bnd.holding?.currentPrice).toBeCloseTo(73); // price worked out from value ÷ shares
    expect(bnd.status).toBe("warning");
    expect(bnd.messages.join(" ")).toMatch(/unsure/);
    expect(bnd.messages).toContain("Last digit blurry");
    expect(cash.cashAmount).toBe(2500);
  });
  it("returns an empty table when nothing was found", () => {
    expect(extractionToTable({ holdings: [], cashAmount: null, issues: ["No table"] }).rows).toEqual([]);
  });
});
