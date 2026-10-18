import type { HoldingClass } from "@/lib/portfolio/types";

/**
 * Demo portfolio (~$500K). Prices and cost bases are ILLUSTRATIVE, not live quotes.
 * Stocks and equity ETFs are "Equities"; broad funds use the "Diversified" sector.
 */
interface DemoHolding {
  ticker: string;
  name: string;
  assetClass: HoldingClass;
  sector: string | null;
  /** Fixed Income: maturity; Alternatives: type. */
  subtype?: string;
  shares: number;
  cost: number;
  price: number;
}

export const DEMO_CASH = 40_000;

export const DEMO_HOLDINGS: DemoHolding[] = [
  // US stocks
  { ticker: "AAPL", name: "Apple Inc.", assetClass: "Equities", sector: "Information Technology", shares: 120, cost: 148.2, price: 232.5 },
  { ticker: "MSFT", name: "Microsoft Corp.", assetClass: "Equities", sector: "Information Technology", shares: 60, cost: 285.0, price: 425.0 },
  { ticker: "NVDA", name: "NVIDIA Corp.", assetClass: "Equities", sector: "Information Technology", shares: 150, cost: 62.4, price: 140.0 },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", assetClass: "Equities", sector: "Communication Services", shares: 110, cost: 105.3, price: 175.0 },
  { ticker: "AMZN", name: "Amazon.com Inc.", assetClass: "Equities", sector: "Consumer Discretionary", shares: 90, cost: 135.8, price: 200.0 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", assetClass: "Equities", sector: "Financials", shares: 100, cost: 142.0, price: 245.0 },
  { ticker: "UNH", name: "UnitedHealth Group", assetClass: "Equities", sector: "Health Care", shares: 40, cost: 520.0, price: 310.0 },
  { ticker: "JNJ", name: "Johnson & Johnson", assetClass: "Equities", sector: "Health Care", shares: 85, cost: 168.0, price: 155.0 },
  { ticker: "CAT", name: "Caterpillar Inc.", assetClass: "Equities", sector: "Industrials", shares: 40, cost: 220.0, price: 390.0 },
  { ticker: "PG", name: "Procter & Gamble", assetClass: "Equities", sector: "Consumer Staples", shares: 80, cost: 152.0, price: 165.0 },
  { ticker: "XOM", name: "Exxon Mobil Corp.", assetClass: "Equities", sector: "Energy", shares: 110, cost: 118.0, price: 108.0 },
  { ticker: "NEE", name: "NextEra Energy", assetClass: "Equities", sector: "Utilities", shares: 120, cost: 78.0, price: 72.0 },
  // Equity ETFs
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "Equities", sector: "Diversified", shares: 120, cost: 410.0, price: 560.0 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", assetClass: "Equities", sector: "Diversified", shares: 60, cost: 380.0, price: 500.0 },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", assetClass: "Equities", sector: "Diversified", shares: 250, cost: 59.0, price: 64.0 },
  // Bond funds
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", assetClass: "Fixed Income", sector: null, subtype: "Medium-term", shares: 800, cost: 76.5, price: 73.4 },
  { ticker: "VCSH", name: "Vanguard Short-Term Corporate Bond ETF", assetClass: "Fixed Income", sector: null, subtype: "Short-term", shares: 300, cost: 79.8, price: 78.2 },
  // Gold / silver
  { ticker: "GLD", name: "SPDR Gold Shares", assetClass: "Alternatives", sector: null, subtype: "Commodities", shares: 120, cost: 185.0, price: 310.0 },
  { ticker: "SLV", name: "iShares Silver Trust", assetClass: "Alternatives", sector: null, subtype: "Commodities", shares: 400, cost: 22.0, price: 32.0 },
];
