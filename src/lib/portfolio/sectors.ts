/** The 11 GICS sectors, in the order they are shown on charts. */
export const SECTORS = [
  "Information Technology",
  "Communication Services",
  "Financials",
  "Consumer Discretionary",
  "Health Care",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
] as const;
export type Sector = (typeof SECTORS)[number];

/**
 * Sector label for broad equity funds (e.g. an S&P 500 ETF). These are left out
 * of the sector-vs-S&P comparison, which looks at individual stocks only.
 */
export const DIVERSIFIED = "Diversified";
