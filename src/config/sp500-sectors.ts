import type { Sector } from "@/lib/portfolio/sectors";

/**
 * The built-in copy of the S&P 500 sector weights (percent). The app normally uses SPY's sector weights from the market data
 * provider, looked up about weekly (see `lib/market/benchmark.ts`); these numbers are only used until the first lookup works
 * and whenever a lookup fails. They are SPY's weights from the provider on `SP500_AS_OF`; you can refresh them by hand
 * (the numbers should add up to about 100).
 */
export const SP500_AS_OF = "2026-10-28";

export const SP500_SECTOR_WEIGHTS: Record<Sector, number> = {
  "Information Technology": 37.57,
  "Communication Services": 9.23,
  Financials: 12.08,
  "Consumer Discretionary": 8.96,
  "Health Care": 9.94,
  Industrials: 8.03,
  "Consumer Staples": 4.95,
  Energy: 3.73,
  Utilities: 2.04,
  "Real Estate": 1.75,
  Materials: 1.7,
};
