// Data layer: the only place that talks to the database.

import { prisma } from "@/lib/db";
import { mergePositions } from "@/lib/portfolio/calc";
import type { HoldingClass, Position } from "@/lib/portfolio/types";
import type { HoldingInput } from "@/lib/holdings/schema";
import type { PricePlan, PriceTarget } from "@/lib/market/refresh-plan";
import { DEMO_CASH, DEMO_HOLDINGS } from "@/config/demo-portfolio";

export interface PortfolioData {
  positions: Position[];
  cash: number;
  isDemoData: boolean;
  /** When prices were last refreshed from the market data API; null = never. */
  pricesUpdatedAt: Date | null;
}

/** On the very first run, fill the database with the demo portfolio. Only ever happens once. */
async function ensureSeeded() {
  const state = await prisma.appState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  if (state.seeded) return;

  await prisma.$transaction([
    prisma.holding.createMany({
      data: DEMO_HOLDINGS.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        assetClass: h.assetClass,
        sector: h.sector,
        subtype: h.subtype ?? null,
        shares: h.shares,
        costBasisPerShare: h.cost,
        currentPrice: h.price,
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
      subtype: r.subtype,
      shares: r.shares,
      costBasisPerShare: r.costBasisPerShare,
      currentPrice: r.currentPrice,
      noLivePrice: r.noLivePrice,
    })),
    cash: cash?.amount ?? 0,
    isDemoData: state?.isDemoData ?? false,
    pricesUpdatedAt: state?.pricesUpdatedAt ?? null,
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

// ---- Writes. Any edit by the user means the portfolio is no longer pure demo data. ----

const leaveDemoMode = () =>
  prisma.appState.upsert({
    where: { id: 1 },
    update: { isDemoData: false },
    create: { id: 1, isDemoData: false, seeded: true },
  });

const toRow = (h: HoldingInput) => ({
  ticker: h.ticker,
  name: h.name,
  assetClass: h.assetClass,
  sector: h.sector,
  subtype: h.subtype,
  shares: h.shares,
  costBasisPerShare: h.costBasisPerShare,
  currentPrice: h.currentPrice,
});

/** Create (id = null) or update a holding. Throws a Prisma P2002 error on a duplicate ticker. */
export async function saveHolding(id: string | null, input: HoldingInput) {
  if (id) await prisma.holding.update({ where: { id }, data: toRow(input) });
  else await prisma.holding.create({ data: toRow(input) });
  await leaveDemoMode();
}

export type DuplicateChoice = "merge" | "replace";
export type AddOutcome = "added" | "merged" | "replaced" | "duplicate";

/**
 * Add a new holding. If the ticker already exists in that class, do nothing
 * ("duplicate") unless the caller says whether to merge (average into the existing
 * position) or replace it with the new data.
 */
export async function addHolding(input: HoldingInput, onDuplicate?: DuplicateChoice): Promise<AddOutcome> {
  const existing = await prisma.holding.findUnique({
    where: { assetClass_ticker: { assetClass: input.assetClass, ticker: input.ticker } },
  });
  if (!existing) {
    await prisma.holding.create({ data: toRow(input) });
    await leaveDemoMode();
    return "added";
  }
  if (!onDuplicate) return "duplicate";
  if (onDuplicate === "replace") {
    await prisma.holding.update({ where: { id: existing.id }, data: toRow(input) });
  } else {
    const merged = mergePositions(existing, input);
    await prisma.holding.update({
      where: { id: existing.id },
      data: { ...merged },
    });
  }
  await leaveDemoMode();
  return onDuplicate === "replace" ? "replaced" : "merged";
}

/**
 * Fill in maturity/type for holdings that have none yet. `found` is keyed "Asset Class:TICKER".
 * Values you already set are never overwritten. Returns how many holdings were updated.
 */
export async function fillSubtypes(found: Record<string, string>): Promise<number> {
  let updated = 0;
  for (const [key, subtype] of Object.entries(found)) {
    const i = key.indexOf(":");
    const assetClass = key.slice(0, i);
    const ticker = key.slice(i + 1);
    const res = await prisma.holding.updateMany({ where: { assetClass, ticker, subtype: null }, data: { subtype } });
    updated += res.count;
  }
  return updated;
}

/** Every holding's id, ticker and class: what a price refresh needs to know. */
export async function getPriceTargets(): Promise<PriceTarget[]> {
  const rows = await prisma.holding.findMany({ select: { id: true, ticker: true, assetClass: true } });
  return rows;
}

export async function getPricesUpdatedAt(): Promise<Date | null> {
  return (await prisma.appState.findUnique({ where: { id: 1 } }))?.pricesUpdatedAt ?? null;
}

/**
 * Save refreshed prices: found prices replace the old ones (and clear the "manual" flag); holdings the
 * API had no price for keep their price and get flagged. `stamp` records the refresh time.
 * Refreshing prices never changes whether the portfolio counts as demo data.
 */
export async function applyPrices(plan: PricePlan, stamp: boolean) {
  await prisma.$transaction([
    ...plan.found.map((f) => prisma.holding.update({ where: { id: f.id }, data: { currentPrice: f.price, noLivePrice: false } })),
    ...(plan.missing.length > 0
      ? [prisma.holding.updateMany({ where: { id: { in: plan.missing } }, data: { noLivePrice: true } })]
      : []),
    ...(stamp
      ? [prisma.appState.upsert({ where: { id: 1 }, update: { pricesUpdatedAt: new Date() }, create: { id: 1, seeded: true, pricesUpdatedAt: new Date() } })]
      : []),
  ]);
}

export async function deleteHolding(id: string) {
  await prisma.holding.delete({ where: { id } });
  await leaveDemoMode();
}

export async function setCash(amount: number) {
  await prisma.cashBalance.upsert({
    where: { id: 1 },
    update: { amount },
    create: { id: 1, amount },
  });
  await leaveDemoMode();
}

export interface ImportResult {
  added: number;
  merged: number;
  replaced: number;
  skipped: number;
}

export type ImportDuplicateChoice = "skip" | DuplicateChoice;

/**
 * Save imported holdings. "add" keeps everything already there; for tickers that already exist
 * in the same class, `onDuplicate` decides: skip them, average them into the existing position
 * (merge), or overwrite the position (replace). "replace" wipes current holdings first.
 * Cash rows from the file are added to (add) or replace (replace) the cash balance.
 */
export async function importHoldings(
  mode: "add" | "replace",
  holdings: HoldingInput[],
  cashAmount?: number,
  onDuplicate: ImportDuplicateChoice = "skip",
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, merged: 0, replaced: 0, skipped: 0 };
  const existing = new Map(
    mode === "add"
      ? (await prisma.holding.findMany()).map((h) => [`${h.assetClass}:${h.ticker}`, h] as const)
      : [],
  );

  const toCreate: HoldingInput[] = [];
  const updates = [];
  for (const h of holdings) {
    const current = existing.get(`${h.assetClass}:${h.ticker}`);
    if (!current) {
      toCreate.push(h);
      result.added++;
    } else if (onDuplicate === "skip") {
      result.skipped++;
    } else if (onDuplicate === "replace") {
      updates.push(prisma.holding.update({ where: { id: current.id }, data: toRow(h) }));
      result.replaced++;
    } else {
      updates.push(prisma.holding.update({ where: { id: current.id }, data: { ...mergePositions(current, h) } }));
      result.merged++;
    }
  }

  const currentCash = (await prisma.cashBalance.findUnique({ where: { id: 1 } }))?.amount ?? 0;
  const newCash =
    cashAmount === undefined ? undefined : mode === "add" ? currentCash + cashAmount : cashAmount;

  await prisma.$transaction([
    ...(mode === "replace" ? [prisma.holding.deleteMany()] : []),
    prisma.holding.createMany({ data: toCreate.map(toRow) }),
    ...updates,
    ...(newCash !== undefined
      ? [prisma.cashBalance.upsert({ where: { id: 1 }, update: { amount: newCash }, create: { id: 1, amount: newCash } })]
      : []),
  ]);
  await leaveDemoMode();
  return result;
}
