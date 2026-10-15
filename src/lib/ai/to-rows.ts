// Convert Claude's extraction into the raw-row shape the CSV/Excel importer already understands,
// so screenshots and PDFs go through exactly the same checks, preview and duplicate handling.

import { NOTES_KEY, type RawRow } from "@/lib/import/normalize";
import type { Extraction } from "./schema";

/** Column names chosen so the importer's matcher picks them up without ambiguity. */
export const AI_HEADERS = [
  "Ticker",
  "Name",
  "Shares",
  "Cost per share",
  "Total cost",
  "Price",
  "Market value",
  "Asset class",
  "Sector",
];

const cell = (v: string | number | null) => (v === null ? "" : v);

export function extractionToTable(ex: Extraction): { headers: string[]; rows: RawRow[] } {
  const rows: RawRow[] = ex.holdings.map((h) => {
    const notes: string[] = [];
    if (h.confidence !== "high") notes.push(`Claude is ${h.confidence === "low" ? "unsure" : "fairly sure"} about this row`);
    if (h.note) notes.push(h.note);
    return {
      Ticker: h.ticker,
      Name: cell(h.name),
      Shares: cell(h.shares),
      "Cost per share": cell(h.costPerShare),
      "Total cost": cell(h.totalCost),
      Price: cell(h.price),
      "Market value": cell(h.marketValue),
      "Asset class": cell(h.assetClass),
      Sector: cell(h.sector),
      [NOTES_KEY]: notes,
    };
  });
  if (ex.cashAmount !== null && ex.cashAmount > 0) {
    rows.push({
      Ticker: "CASH",
      Name: "",
      Shares: "",
      "Cost per share": "",
      "Total cost": "",
      Price: "",
      "Market value": ex.cashAmount,
      "Asset class": "Cash",
      Sector: "",
      [NOTES_KEY]: [],
    });
  }
  return { headers: AI_HEADERS, rows };
}
