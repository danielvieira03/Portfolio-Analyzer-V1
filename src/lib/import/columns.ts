// Match spreadsheet headers to our fields using flexible names.

export const IMPORT_FIELDS = ["ticker", "name", "shares", "cost", "price", "assetClass", "sector"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const ALIASES: Record<ImportField, string[]> = {
  ticker: ["ticker", "symbol", "tickersymbol", "security", "code"],
  name: ["name", "description", "securityname", "company", "holding", "assetname"],
  shares: ["shares", "qty", "quantity", "units", "position", "noofshares"],
  cost: ["cost", "avgcost", "averagecost", "costbasis", "costpershare", "costbasispershare", "avgprice", "averageprice", "purchaseprice", "unitcost", "basis"],
  price: ["price", "currentprice", "lastprice", "marketprice", "last", "closeprice", "close"],
  assetClass: ["assetclass", "class", "assettype", "type", "category", "assetcategory"],
  sector: ["sector", "industry", "gicssector"],
};

/** Lower-case and strip everything except letters and digits: "Avg. Cost" -> "avgcost". */
export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map each field to the header text that matches it (first match wins). */
export function matchColumns(headers: string[]): Partial<Record<ImportField, string>> {
  const result: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    // Prefer exact alias order so "Ticker" beats "Security" when both exist.
    for (const alias of ALIASES[field]) {
      const hit = headers.find((h) => !used.has(h) && normalizeHeader(h) === alias);
      if (hit) {
        result[field] = hit;
        used.add(hit);
        break;
      }
    }
  }
  return result;
}
