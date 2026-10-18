// The fund library (known maturities / types). Part of the data layer: the only code that talks to Prisma.

import { FUND_LIBRARY } from "@/config/fund-library";
import { prisma } from "@/lib/db";
import type { FundRecord } from "@/lib/funds/library";

/** Insert the built-in starting list exactly once. A fund deleted later never comes back. */
export async function ensureFundLibrary(): Promise<void> {
  const state = await prisma.appState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (state.fundsSeeded) return;
  await prisma.$transaction([
    prisma.fundInfo.createMany({
      data: FUND_LIBRARY.map((f) => ({
        ticker: f.ticker,
        name: f.name,
        assetClass: f.assetClass,
        subtype: f.subtype,
        durationYears: f.duration ?? null,
        source: "builtin",
      })),
    }),
    prisma.appState.update({ where: { id: 1 }, data: { fundsSeeded: true } }),
  ]);
}

/** The library entries for these tickers (upper-case). */
export async function getFunds(tickers: string[]): Promise<FundRecord[]> {
  await ensureFundLibrary();
  return prisma.fundInfo.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, name: true, assetClass: true, subtype: true, durationYears: true },
  });
}

/** Add funds Claude looked up. An existing entry is never overwritten. */
export async function saveFunds(funds: FundRecord[]): Promise<void> {
  if (funds.length === 0) return;
  await prisma.fundInfo.createMany({
    data: funds.map((f) => ({ ...f, source: "claude" })),
  });
}
