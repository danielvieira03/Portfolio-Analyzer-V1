// The starting fund library: well-known bond and alternatives funds whose maturity / type the app
// already knows, so Claude is never asked (and nothing is spent) when you hold one of them.
// Inserted into the database once; funds Claude finds later are added there too.
//
// Bond figures were read from the issuers' pages: iShares (ishares.com, as of Oct 15, 2026) and
// Vanguard (Vanguard's own product pages, as of Sep 30, 2026). The Maturity bucket follows the app's
// rule on AVERAGE MATURITY (Short under ~3 years, Medium 3 to 10, Long over 10); `duration` is the
// fund's average / effective duration in years, saved but not shown anywhere yet.

import type { SubtypeClass } from "./subtypes";

export interface LibraryFund {
  ticker: string;
  name: string;
  assetClass: SubtypeClass;
  subtype: string;
  /** Years; bond funds only. */
  duration?: number;
}

const bond = (ticker: string, name: string, subtype: string, duration: number): LibraryFund => ({
  ticker, name, assetClass: "Fixed Income", subtype, duration,
});
const alt = (ticker: string, name: string, subtype: string): LibraryFund => ({
  ticker, name, assetClass: "Alternatives", subtype,
});

export const FUND_LIBRARY: LibraryFund[] = [
  // Short-term
  bond("SGOV", "iShares 0-3 Month Treasury Bond ETF", "Short-term", 0.11),
  bond("SHY", "iShares 1-3 Year Treasury Bond ETF", "Short-term", 1.81),
  bond("VGSH", "Vanguard Short-Term Treasury ETF", "Short-term", 1.8),
  bond("BSV", "Vanguard Short-Term Bond ETF", "Short-term", 2.6),
  // Average maturity 3.1 years, right on the line; kept Short-term (duration 2.7, and the app already showed it so).
  bond("VCSH", "Vanguard Short-Term Corporate Bond ETF", "Short-term", 2.7),
  // Medium-term
  bond("HYG", "iShares iBoxx $ High Yield Corporate Bond ETF", "Medium-term", 3.2),
  bond("IEI", "iShares 3-7 Year Treasury Bond ETF", "Medium-term", 4.22),
  bond("TIP", "iShares TIPS Bond ETF", "Medium-term", 6.19),
  bond("BIV", "Vanguard Intermediate-Term Bond ETF", "Medium-term", 5.9),
  bond("GOVT", "iShares U.S. Treasury Bond ETF", "Medium-term", 5.49),
  bond("VCIT", "Vanguard Intermediate-Term Corporate Bond ETF", "Medium-term", 5.9),
  bond("MBB", "iShares MBS ETF", "Medium-term", 5.75),
  bond("BNDX", "Vanguard Total International Bond ETF", "Medium-term", 6.4),
  bond("AGG", "iShares Core U.S. Aggregate Bond ETF", "Medium-term", 5.7),
  bond("BND", "Vanguard Total Bond Market ETF", "Medium-term", 5.7),
  bond("IEF", "iShares 7-10 Year Treasury Bond ETF", "Medium-term", 6.85),
  // Long-term
  bond("LQD", "iShares iBoxx $ Investment Grade Corporate Bond ETF", "Long-term", 7.59),
  bond("BLV", "Vanguard Long-Term Bond ETF", "Long-term", 12.4),
  bond("VCLT", "Vanguard Long-Term Corporate Bond ETF", "Long-term", 11.6),
  bond("TLT", "iShares 20+ Year Treasury Bond ETF", "Long-term", 14.85),
  // iShares product page, Oct 16, 2026: effective duration 6.32 yrs, weighted average maturity 10.48 yrs (over 10, so Long-term).
  bond("EMB", "iShares J.P. Morgan USD Emerging Markets Bond ETF", "Long-term", 6.32),

  // Commodities
  alt("GLD", "SPDR Gold Shares", "Commodities"),
  alt("IAU", "iShares Gold Trust", "Commodities"),
  alt("GLDM", "SPDR Gold MiniShares Trust", "Commodities"),
  alt("SGOL", "abrdn Physical Gold Shares ETF", "Commodities"),
  alt("SLV", "iShares Silver Trust", "Commodities"),
  alt("USO", "United States Oil Fund", "Commodities"),
  alt("DBC", "Invesco DB Commodity Index Tracking Fund", "Commodities"),
  alt("PDBC", "Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF", "Commodities"),
  // REITs
  alt("VNQ", "Vanguard Real Estate ETF", "REITs"),
  alt("VNQI", "Vanguard Global ex-U.S. Real Estate ETF", "REITs"),
  alt("XLRE", "Real Estate Select Sector SPDR Fund", "REITs"),
  alt("SCHH", "Schwab U.S. REIT ETF", "REITs"),
  // Crypto
  alt("IBIT", "iShares Bitcoin Trust ETF", "Crypto"),
  alt("FBTC", "Fidelity Wise Origin Bitcoin Fund", "Crypto"),
  alt("GBTC", "Grayscale Bitcoin Trust", "Crypto"),
  alt("ETHA", "iShares Ethereum Trust ETF", "Crypto"),
  // Infrastructure
  alt("IFRA", "iShares U.S. Infrastructure ETF", "Infrastructure"),
  alt("NFRA", "FlexShares STOXX Global Broad Infrastructure Index Fund", "Infrastructure"),
  alt("PAVE", "Global X U.S. Infrastructure Development ETF", "Infrastructure"),
  // Other
  alt("DBMF", "iMGP DBi Managed Futures Strategy ETF", "Other"),
];
