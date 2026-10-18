// Turn raw spreadsheet rows into clean, checked holdings plus warnings.
// Nothing here touches the database; the preview screen shows the result.

import { holdingSchema, SECTOR_OPTIONS, type HoldingInput } from "@/lib/holdings/schema";
import type { HoldingClass } from "@/lib/portfolio/types";
import { matchColumns, missingRequired, type ColumnMap, type ImportField } from "./columns";

export type RawRow = Record<string, unknown>;

/** Special key a row can carry to hand extra warnings to the preview (used by the AI reader). */
export const NOTES_KEY = "__notes";

export interface ParsedRow {
  /** 1-based position of the row among the data rows (header excluded), +1 to match spreadsheet numbering. */
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
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * A vague "Cost" column is either per-share or the whole position. Compare it with the price:
 * per-share cost sits near the price, total cost sits near price x shares. Majority of rows wins.
 */
export function detectCostIsTotal(
  raw: RawRow[],
  columns: Partial<Record<ImportField, string>>,
): boolean {
  let total = 0;
  let perShare = 0;
  for (const row of raw) {
    const shares = parseNumber(columns.shares ? row[columns.shares] : undefined);
    const cost = parseNumber(columns.cost ? row[columns.cost] : undefined);
    let price = parseNumber(columns.price ? row[columns.price] : undefined);
    const value = parseNumber(columns.value ? row[columns.value] : undefined);
    if (price === undefined && value !== undefined && shares) price = value / shares;
    if (!shares || shares <= 1 || !cost || !price || cost <= 0 || price <= 0) continue;
    const dPer = Math.abs(Math.log(cost / price));
    const dTot = Math.abs(Math.log(cost / (price * shares)));
    if (dTot < dPer) total++;
    else perShare++;
  }
  return total > perShare;
}

export function parseImportRows(
  raw: RawRow[],
  headers: string[],
  options: { columns?: ColumnMap; headerRow?: number; defaultAssetClass?: HoldingClass } = {},
): ParsedImport {
  const map = options.columns ?? matchColumns(headers);
  const columns = map.columns;
  const missing = missingRequired(columns);
  if (missing.length) return { rows: [], columns, missingRequired: missing };

  const costIsTotal = map.costAmbiguous && detectCostIsTotal(raw, columns);
  const get = (row: RawRow, f: ImportField) => (columns[f] ? row[columns[f]!] : undefined);
  const seen = new Set<string>();
  const rows: ParsedRow[] = [];

  raw.forEach((row, i) => {
    const line = (options.headerRow ?? 1) + i + 1;
    const ticker = text(get(row, "ticker")).toUpperCase();
    const isBlank = Object.entries(row).every(([k, v]) => k === NOTES_KEY || text(v) === "");
    if (isBlank) return; // skip blank lines
    const messages: string[] = Array.isArray(row[NOTES_KEY]) ? (row[NOTES_KEY] as string[]).filter(Boolean) : [];
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
      assetClass = options.defaultAssetClass ?? "Equities";
      // With no asset class column at all the preview offers one default for the whole file instead.
      if (columns.assetClass) messages.push(`No asset class — assumed ${assetClass}`);
    }

    // Numbers
    let shares = parseNumber(get(row, "shares"));
    let cost = parseNumber(get(row, "cost"));
    const costTotal = parseNumber(get(row, "costTotal"));
    let price = parseNumber(get(row, "price"));
    const value = parseNumber(get(row, "value"));
    const bad = [shares, cost, costTotal, price].some((n) => n !== undefined && Number.isNaN(n));

    if (assetClass === "Cash") {
      const amount = value !== undefined && !Number.isNaN(value) ? value : shares !== undefined && !bad ? shares * (price ?? 1) : undefined;
      if (amount === undefined) return fail("Cash amount missing");
      if (!(amount >= 0)) return fail("Cash amount can't be negative");
      messages.push("Cash row — added to the cash balance");
      rows.push({ line, status: "warning", messages, cashAmount: amount, label: ticker });
      return;
    }

    if (bad) return fail("Shares, cost or price is not a number");
    const valueOk = value !== undefined && !Number.isNaN(value) ? value : undefined;

    if (shares === undefined) {
      if (valueOk !== undefined && price !== undefined && price > 0) {
        shares = valueOk / price;
        messages.push(`No shares — worked out as value ÷ price (${money(shares)})`);
      } else return fail("Shares missing (and can't be worked out from value ÷ price)");
    }
    if (price === undefined && valueOk !== undefined && shares > 0) {
      price = valueOk / shares;
      messages.push("No price — worked out as value ÷ shares");
    }

    // Cost: prefer an explicit total, else the cost column (which may itself be a total).
    if (costTotal !== undefined && shares > 0) {
      cost = costTotal / shares;
      messages.push(`Total cost ${money(costTotal)} converted to cost per share`);
    } else if (cost !== undefined && costIsTotal && shares > 0) {
      messages.push(`Cost column looks like a total — ${money(cost)} converted to cost per share`);
      cost = cost / shares;
    }

    if (cost === undefined && price === undefined) return fail("Needs a cost or a price");
    if (price === undefined) { price = cost; messages.push("No price — using cost as the current price"); }
    if (cost === undefined) { cost = price; messages.push("No cost — using price as the cost basis"); }

    // Consistency check against the value column.
    if (valueOk !== undefined && price !== undefined) {
      const expected = shares * price;
      if (Math.abs(expected - valueOk) / Math.max(Math.abs(valueOk), 1) > 0.02) {
        messages.push(`Value ${money(valueOk)} doesn't match shares × price (${money(expected)})`);
      }
    }

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
    });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    if (columns.name && !text(get(row, "name"))) messages.push("No name — using the ticker");

    rows.push({
      line,
      status: messages.length ? "warning" : "ok",
      messages,
      holding: parsed.data,
      label: ticker,
    });
  });

  return { rows, columns, missingRequired: [] };
}
