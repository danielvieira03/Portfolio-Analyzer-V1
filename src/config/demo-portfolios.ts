// The three demo portfolios on the home page. Each is built to show a different part of the analyzer.
// The holdings and fund weights are plain data in ./demo-data.ts (captured once from market data).

import {
  CONSERVATIVE_CASH, CONSERVATIVE_HOLDINGS, GLOBAL_CASH, GLOBAL_HOLDINGS, GROWTH_CASH, GROWTH_HOLDINGS, type DemoHolding,
} from "./demo-data";

export type DemoId = "conservative" | "global" | "growth";

export interface DemoPortfolio {
  id: DemoId;
  name: string;
  tagline: string;
  /** What this demo is built to show, as short bullets on its card. */
  shows: string[];
  cash: number;
  holdings: DemoHolding[];
}

export const DEMO_PORTFOLIOS: DemoPortfolio[] = [
  {
    id: "conservative",
    name: "Conservative Income",
    tagline: "Mostly bonds, with gold and real estate for balance.",
    shows: ["A low score on the risk meter", "Bond maturities and alternatives breakdowns", "Almost all exposure in the United States"],
    cash: CONSERVATIVE_CASH,
    holdings: CONSERVATIVE_HOLDINGS,
  },
  {
    id: "global",
    name: "Global Diversified",
    tagline: "A balanced mix spread across many countries.",
    shows: ["Geographic exposure on the world map", "Funds split by country (look-through)", "A moderate risk score"],
    cash: GLOBAL_CASH,
    holdings: GLOBAL_HOLDINGS,
  },
  {
    id: "growth",
    name: "Aggressive Growth",
    tagline: "Mostly stocks, tilted to tech and the biggest economies.",
    shows: ["A high score on the risk meter", "Sector concentration versus the S&P 500", "The largest economies: US, China, Japan, India, Germany, UK"],
    cash: GROWTH_CASH,
    holdings: GROWTH_HOLDINGS,
  },
];

export const demoById = (id: DemoId): DemoPortfolio => DEMO_PORTFOLIOS.find((d) => d.id === id)!;
