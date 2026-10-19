// Settings for the market data connection (Financial Modeling Prep).

/**
 * How often prices refresh on their own, in minutes, while the app is open. Change ONLY this number.
 * One refresh costs one market data call per holding, for every open tab. The Starter plan allows
 * 300 calls a minute; on the free plan (about 250 calls a day) use a much larger number such as 180.
 */
export const PRICE_REFRESH_MINUTES = 2;

/**
 * How often a fund's sector and country weights are looked up again, in days (they change slowly).
 * Each lookup is 2 market data calls per equity ETF (1 per bond fund); a newly added fund is looked up on its first refresh.
 */
export const BREAKDOWN_REFRESH_DAYS = 7;
/** Most funds looked up in one refresh (the rest wait for the next one). */
export const BREAKDOWN_MAX_PER_REFRESH = 50;

/**
 * The name FMP uses for each sector, mapped to the app's S&P 500 style sector names. FMP uses its own names for
 * companies but the fund company's S&P / GICS style names for many ETFs (e.g. iShares funds say "Financials",
 * "Health Care", "Communication"), so both spellings are listed. Anything not listed counts as Unclassified.
 */
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
  // The S&P / GICS style spellings many ETFs use (and the app's own names).
  "Information Technology": "Information Technology",
  Financials: "Financials",
  "Health Care": "Health Care",
  "Consumer Discretionary": "Consumer Discretionary",
  "Consumer Staples": "Consumer Staples",
  Materials: "Materials",
  Communication: "Communication Services",
  "Communications": "Communication Services",
  "Telecommunications": "Communication Services",
};

/**
 * Saved fund breakdowns older than this are looked up again, even if they are less than a week old. Raise it
 * (to the current date and time) whenever the translation of the provider's sector or country names is
 * improved, so visitors don't keep a partly translated copy for a week.
 */
export const BREAKDOWN_MAPPING_UPDATED = "2026-10-19T02:40:00.000Z";
