// Match spreadsheet headers to our fields using flexible names.

export const IMPORT_FIELDS = [
  "ticker",
  "name",
  "shares",
  "cost", // cost per share (or an ambiguous "Cost" column — see ColumnMap.costAmbiguous)
  "costTotal", // total cost of the whole position
  "price",
  "value", // current market value of the whole position
  "assetClass",
  "sector",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export interface ColumnMap {
  columns: Partial<Record<ImportField, string>>;
  /** True when "cost" came from a vague header like "Cost" — the data decides if it is per-share or total. */
  costAmbiguous: boolean;
}

/** Friendly labels for the "Map your columns" screen. */
export const FIELD_LABELS: Record<ImportField, string> = {
  ticker: "Ticker / Symbol",
  name: "Name",
  shares: "Shares / Quantity",
  cost: "Cost per share",
  costTotal: "Total cost",
  price: "Current price",
  value: "Market value",
  assetClass: "Asset class",
  sector: "Sector",
};

// Exact (normalized) header names. Checked first.
const ALIASES: Record<ImportField, string[]> = {
  ticker: ["ticker", "symbol", "tickersymbol", "stocksymbol", "code", "instrument", "sym", "ticker/symbol"],
  name: ["name", "description", "securityname", "companyname", "company", "holding", "assetname", "securitydescription", "instrumentname", "security"],
  shares: ["shares", "qty", "quantity", "units", "position", "noofshares", "numberofshares", "sharesowned", "quantityheld", "sharesheld", "shs", "sharecount", "shareqty"],
  cost: [
    "avgcost", "averagecost", "costpershare", "costbasispershare", "unitcost", "avgprice", "averageprice",
    "purchaseprice", "avgcostbasis", "averagecostbasis", "pricepaid", "buyprice", "avgbuyprice", "costshare", "costsh",
  ],
  costTotal: ["totalcost", "totalcostbasis", "costbasistotal", "bookvalue", "bookcost", "totalbasis", "invested", "investedamount", "amountinvested"],
  price: ["price", "currentprice", "lastprice", "marketprice", "last", "closeprice", "close", "currentshareprice", "shareprice"],
  value: ["value", "marketvalue", "totalvalue", "currentvalue", "mktvalue", "mktval", "marketval", "positionvalue"],
  assetClass: ["assetclass", "class", "assettype", "type", "category", "assetcategory", "securitytype"],
  sector: ["sector", "industry", "gicssector"],
};
// Vague cost headers: could be per share or the position total.
const AMBIGUOUS_COST = ["cost", "basis", "costbasis"];

/** Lower-case and strip everything except letters and digits: "Avg. Cost" -> "avgcost". */
export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const words = (h: string) => h.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Looser, word-based guess used only when no exact name matched. */
function guessField(header: string): { field: ImportField; ambiguousCost?: boolean } | null {
  const w = words(header);
  const has = (...xs: string[]) => xs.some((x) => w.includes(x));
  if (has("ticker", "symbol")) return { field: "ticker" };
  if (has("shares", "share", "qty", "quantity", "units")) {
    // "Cost per share" / "Price per share" contain the word share — those are not counts.
    if (!has("cost", "price", "basis", "value")) return { field: "shares" };
  }
  if (has("cost", "basis")) {
    if (has("total", "book")) return { field: "costTotal" };
    if (has("per", "avg", "average", "unit")) return { field: "cost" };
    return { field: "cost", ambiguousCost: true };
  }
  if (has("value", "worth") && !has("book")) return { field: "value" };
  if (has("price", "last", "close") && !has("avg", "average", "paid", "purchase", "buy")) return { field: "price" };
  if (has("sector", "industry")) return { field: "sector" };
  if (has("class", "category")) return { field: "assetClass" };
  if (has("name", "description", "company", "security")) return { field: "name" };
  return null;
}

/** Map each field to the header text that matches it. Exact names win over guesses. */
export function matchColumns(headers: string[]): ColumnMap {
  const columns: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();
  let costAmbiguous = false;
  const claim = (field: ImportField, header: string) => {
    columns[field] = header;
    used.add(header);
  };

  // Pass 1: exact names.
  for (const field of IMPORT_FIELDS) {
    for (const alias of ALIASES[field]) {
      const hit = headers.find((h) => !used.has(h) && normalizeHeader(h) === alias);
      if (hit) {
        claim(field, hit);
        break;
      }
    }
  }
  // Pass 1b: a plain "Cost" / "Basis" header.
  if (!columns.cost) {
    const hit = headers.find((h) => !used.has(h) && AMBIGUOUS_COST.includes(normalizeHeader(h)));
    if (hit) {
      claim("cost", hit);
      costAmbiguous = true;
    }
  }
  // Pass 2: word-based guesses for anything still missing.
  for (const header of headers) {
    if (used.has(header)) continue;
    const g = guessField(header);
    if (g && !columns[g.field]) {
      claim(g.field, header);
      if (g.field === "cost") costAmbiguous = !!g.ambiguousCost;
    }
  }
  return { columns, costAmbiguous };
}

/** Which required inputs are still missing? Empty array means we can import. */
export function missingRequired(columns: Partial<Record<ImportField, string>>): string[] {
  const missing: string[] = [];
  if (!columns.ticker) missing.push("Ticker / Symbol");
  if (!columns.shares && !(columns.value && columns.price)) missing.push("Shares / Quantity (or Market value + Price)");
  if (!columns.cost && !columns.costTotal && !columns.price) missing.push("Cost or Price");
  return missing;
}
