// Settings for the market data connection (Financial Modeling Prep).

/**
 * How often prices refresh on their own, in minutes. Change ONLY this number.
 * On the free plan (250 calls a day) one refresh costs one call per holding, so
 * raise it (e.g. 180) if the app stays open all day.
 */
export const PRICE_REFRESH_MINUTES = 60;

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
