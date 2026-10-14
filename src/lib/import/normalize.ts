// Turn raw spreadsheet rows into clean, checked holdings plus warnings.
// Nothing here touches the database; the preview screen shows the result.

import { SECTOR_OPTIONS } from "@/lib/holdings/schema";
import { holdingSchema, type HoldingInput } from "@/lib/holdings/schema";
import type { HoldingClass } from "@/lib/portfolio/types";
import { matchColumns, type ImportField } from "./columns";

export type RawRow = Record<string, unknown>;

export interface ParsedRow {
  /** 1-based row number in the file (header is row 1, so data starts at 2). */
  line: number;
  status: "ok" | "warning" | "error";
  messages: string[];
  /** Present unless status is "error". */
  holding?: HoldingInput;
  /** Cash rows add to the cash balance instead of becoming a holding. */
  cashAmount?: number;
  label: string;
}

export interface ParsedImport {
  rows: ParsedRow[];
  /** Which spreadsheet header was used for each field. */
  columns: Partial<Record<ImportField, string>>;
  missingRequired: string[];
}

const CLASS_ALIASES: Record<string, HoldingClass | "Cash"> = {
  equities: "Equities", equity: "Equities", stock: "Equities", stocks: "Equities", etf: "Equities", etfs: "Equities", fund: "Equities", shares: "Equities",
  fixedincome: "Fixed Income", bond: "Fixed Income", bonds: "Fixed Income", fixed: "Fixed Income", debt: "Fixed Income",
  alternatives: "Alternatives", alternative: "Alternatives", alts: "Alternatives", commodity: "Alternatives", commodities: "Alternatives", gold: "Alternatives", realestate: "Alternatives", crypto: "Alternatives",
  cash: "Cash", moneymarket: "Cash",
};

const SECTOR_ALIASES: Record<string, string> = {
  technology: "Information Technology", infotech: "Information Technology", it: "Information Technology",
  healthcare: "Health Care", health: "Health Care",
  financialservices: "Financials", finance: "Financials", financial: "Financials",
  consumercyclical: "Consumer Discretionary", discretionary: "Consumer Discretionary",
  consumerdefensive: "Consumer Staples", staples: "Consumer Staples",
  telecom: "Communication Services", communications: "Communication Services", communication: "Communication Services",
  industrial: "Industrials", basicmaterials: "Materials", utility: "Utilities", realestate: "Real Estate",
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "$1,234.50" or 1234.5 -> 1234.5. Returns undefined when empty, NaN when unreadable. */
export function parseNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (s === "") return undefined;
  const negative = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[$,\s()%]/g, ""));
  return Number.isNaN(n) ? NaN : negative ? -n : n;
}

function normalizeSector(raw: string): string | undefined {
  const k = key(raw);
  const exact = SECTOR_OPTIONS.find((s) => key(s) === k);
  return exact ?? SECTOR_ALIASES[k];
}

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function parseImportRows(
  raw: RawRow[],
  headers: string[],
  today: Date = new Date(),
): ParsedImport {
  const columns = matchColumns(headers);
  const missingRequired: string[] = [];
  if (!columns.ticker) missingRequired.push("Ticker / Symbol");
  if (!columns.shares) missingRequired.push("Shares / Qty");
  if (!columns.cost && !columns.price) missingRequired.push("Cost or Price");
  if (missingRequired.length) return { rows: [], columns, missingRequired };

  const get = (row: RawRow, f: ImportField) => (columns[f] ? row[columns[f]!] : undefined);
  const seen = new Set<string>();
  const rows: ParsedRow[] = [];

  raw.forEach((row, i) => {
    const line = i + 2;
    const ticker = text(get(row, "ticker")).toUpperCase();
    if (Object.values(row).every((v) => text(v) === "")) return; // skip blank lines
    const messages: string[] = [];
    const fail = (msg: string): void => {
      rows.push({ line, status: "error", messages: [...messages, msg], label: ticker || `Row ${line}` });
    };

    if (!ticker) return fail("Missing ticker");

    // Asset class
    const classText = text(get(row, "assetClass"));
    let assetClass: HoldingClass | "Cash";
    if (classText) {
      const mapped = CLASS_ALIASES[key(classText)];
      if (!mapped) return fail(`Unknown asset class "${classText}"`);
      assetClass = mapped;
    } else {
      assetClass = "Equities";
      messages.push("No asset class — assumed Equities");
    }

    // Numbers
    const shares = parseNumber(get(row, "shares"));
    let cost = parseNumber(get(row, "cost"));
    let price = parseNumber(get(row, "price"));
    if (shares === undefined || Number.isNaN(shares)) return fail("Shares missing or not a number");
    if (Number.isNaN(cost) || Number.isNaN(price)) return fail("Cost or price is not a number");

    if (assetClass === "Cash") {
      const amount = shares * (price ?? 1);
      if (!(amount >= 0)) return fail("Cash amount can't be negative");
      messages.push("Cash row — added to the cash balance");
      rows.push({ line, status: "warning", messages, cashAmount: amount, label: ticker });
      return;
    }

    if (cost === undefined && price === undefined) return fail("Needs a cost or a price");
    if (price === undefined) { price = cost; messages.push("No price — using cost as the current price"); }
    if (cost === undefined) { cost = price; messages.push("No cost — using price as the cost basis"); }

    // Sector (equities only)
    let sector: string | null = null;
    const sectorText = text(get(row, "sector"));
    if (assetClass === "Equities" && sectorText) {
      const s = normalizeSector(sectorText);
      if (s) sector = s;
      else messages.push(`Unknown sector "${sectorText}" — left blank`);
    } else if (assetClass !== "Equities" && sectorText) {
      messages.push("Sector ignored (equities only)");
    }

    const dupKey = `${assetClass}:${ticker}`;
    if (seen.has(dupKey)) return fail(`Duplicate ticker in ${assetClass}`);
    seen.add(dupKey);

    const parsed = holdingSchema.safeParse({
      ticker,
      name: text(get(row, "name")) || ticker,
      assetClass,
      sector,
      shares,
      costBasisPerShare: cost,
      currentPrice: price,
      priceAsOf: today,
    });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    if (!text(get(row, "name"))) messages.push("No name — using the ticker");

    rows.push({
      line,
      status: messages.length ? "warning" : "ok",
      messages,
      holding: parsed.data,
      label: ticker,
    });
  });

  return { rows, columns, missingRequired };
}
