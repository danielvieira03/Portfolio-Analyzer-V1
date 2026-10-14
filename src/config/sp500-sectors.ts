import type { Sector } from "@/lib/portfolio/sectors";

/**
 * S&P 500 sector weights used as the benchmark on the Dashboard.
 *
 * EDIT THIS FILE to refresh the benchmark: change the numbers (percent, should
 * add up to ~100) and the `asOf` date. The date is shown on the chart.
 * Approximate figures — check the current S&P Dow Jones Indices factsheet.
 */
export const SP500_AS_OF = "2025-12-31";

export const SP500_SECTOR_WEIGHTS: Record<Sector, number> = {
  "Information Technology": 33.9,
  "Communication Services": 10.5,
  Financials: 13.5,
  "Consumer Discretionary": 10.5,
  "Health Care": 9.0,
  Industrials: 8.5,
  "Consumer Staples": 5.0,
  Energy: 3.0,
  Utilities: 2.4,
  "Real Estate": 1.9,
  Materials: 1.8,
};
