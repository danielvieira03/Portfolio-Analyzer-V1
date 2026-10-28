import type { Sector } from "@/lib/portfolio/sectors";

/**
 * S&P 500 sector weights used as the benchmark on the Dashboard.
 *
 * EDIT THIS FILE to refresh the benchmark: change the numbers (percent, should
 * add up to ~100) and the `asOf` date. The date is shown on the chart.
 * Approximate figures: taken from historyofmarket.com/sp500/sectors (live market-cap weights), not from the official
 * S&P Dow Jones Indices factsheet; check that factsheet for exact numbers.
 */
export const SP500_AS_OF = "2026-10-28";

export const SP500_SECTOR_WEIGHTS: Record<Sector, number> = {
  "Information Technology": 37.2,
  "Communication Services": 9.4,
  Financials: 12.3,
  "Consumer Discretionary": 9.7,
  "Health Care": 9.5,
  Industrials: 7.8,
  "Consumer Staples": 5.3,
  Energy: 3.6,
  Utilities: 2.0,
  "Real Estate": 1.7,
  Materials: 1.6,
};
