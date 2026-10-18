// Settings for the market data connection (Financial Modeling Prep).

/**
 * How often prices refresh on their own, in minutes, while the app is open. Change ONLY this number.
 * One refresh costs one market data call per holding, for every open tab. The Starter plan allows
 * 300 calls a minute; on the free plan (about 250 calls a day) use a much larger number such as 180.
 */
export const PRICE_REFRESH_MINUTES = 2;

/** The name FMP uses for each sector, mapped to the app's S&P 500 style sector names. */
export const FMP_SECTOR_MAP: Record<string, string> = {
  Technology: "Information Technology",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  Healthcare: "Health Care",
  "Financial Services": "Financials",
  "Basic Materials": "Materials",
  Industrials: "Industrials",
  Energy: "Energy",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
  "Communication Services": "Communication Services",
};
