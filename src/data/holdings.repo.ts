// Data layer: the only place that talks to the database.

import { prisma } from "@/lib/db";
import type { HoldingClass, Position } from "@/lib/portfolio/types";
import { DEMO_CASH, DEMO_HOLDINGS } from "./seed-demo";

export interface PortfolioData {
  positions: Position[];
  cash: number;
  isDemoData: boolean;
}

/** On the very first run, fill the database with the demo portfolio. Only ever happens once. */
async function ensureSeeded() {
  const state = await prisma.appState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  if (state.seeded) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.holding.createMany({
      data: DEMO_HOLDINGS.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        assetClass: h.assetClass,
        sector: h.sector,
        shares: h.shares,
        costBasisPerShare: h.cost,
        currentPrice: h.price,
        priceAsOf: now,
      })),
    }),
    prisma.cashBalance.upsert({
      where: { id: 1 },
      update: { amount: DEMO_CASH },
      create: { id: 1, amount: DEMO_CASH },
    }),
    prisma.appState.update({ where: { id: 1 }, data: { seeded: true, isDemoData: true } }),
  ]);
}

export async function getPortfolio(): Promise<PortfolioData> {
  await ensureSeeded();
  const [rows, cash, state] = await Promise.all([
    prisma.holding.findMany({ orderBy: { ticker: "asc" } }),
    prisma.cashBalance.findUnique({ where: { id: 1 } }),
    prisma.appState.findUnique({ where: { id: 1 } }),
  ]);
  return {
    positions: rows.map((r) => ({
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      assetClass: r.assetClass as HoldingClass,
      sector: r.sector,
      shares: r.shares,
      costBasisPerShare: r.costBasisPerShare,
      currentPrice: r.currentPrice,
      priceAsOf: r.priceAsOf,
    })),
    cash: cash?.amount ?? 0,
    isDemoData: state?.isDemoData ?? false,
  };
}

/** Remove every holding and zero the cash. The demo is never re-seeded afterwards. */
export async function clearDemoData() {
  await prisma.$transaction([
    prisma.holding.deleteMany(),
    prisma.cashBalance.upsert({
      where: { id: 1 },
      update: { amount: 0 },
      create: { id: 1, amount: 0 },
    }),
    prisma.appState.update({ where: { id: 1 }, data: { isDemoData: false } }),
  ]);
}
