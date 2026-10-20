// Reading and writing a saved portfolio as text: what the browser keeps, and the backup file.
// Anything read from outside (browser storage that may be damaged, a file the user picked) is
// validated here before it is used. Pure: no browser, no network.

import { z } from "zod";
import { isValidSubtype } from "@/config/subtypes";
import { holdingSchema } from "@/lib/holdings/schema";
import type { FundRecord } from "@/lib/funds/library";
import { DOC_VERSION, type PortfolioDoc } from "./ledger";
import { HOLDING_CLASSES } from "./types";

export const BACKUP_FORMAT = "portfolio-analyzer-backup";
/** Largest backup file accepted, in characters (a portfolio is a few KB; this stops absurd files). */
export const MAX_BACKUP_CHARS = 2_000_000;
const MAX_HOLDINGS = 2000;
const MAX_FUNDS = 5000;

const money = z.number().finite().min(0);
const cashAmount = z.number().finite().min(0).max(1e12);
const isoTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Not a valid date");

const fundSchema = z
  .object({
    ticker: z.string().trim().min(1).max(12),
    name: z.string().trim().min(1).max(200),
    assetClass: z.enum(["Fixed Income", "Alternatives"]),
    subtype: z.string(),
    durationYears: z.number().finite().min(0).max(60).nullable(),
  })
  .refine((f) => isValidSubtype(f.assetClass, f.subtype), "Maturity / type not allowed for this class");

const breakdownSchema = z.object({
  sectors: z.array(z.object({ name: z.string().min(1).max(60), weight: z.number().finite().gt(0).max(1) })).max(60),
  countries: z.array(z.object({ code: z.string().regex(/^[A-Z]{2}$/), weight: z.number().finite().gt(0).max(1) })).max(300),
  updatedAt: isoTime,
  status: z.enum(["ok", "none"]),
  // Added in v1.2.1: saves made before it have none, which counts as the first version.
  mapping: z.number().int().min(1).max(1000).optional(),
  // Added after v1.4: weights Claude read from a fund page. Saves made before it have none (= the market data's own).
  source: z.literal("claude").optional(),
});
const breakdownsSchema = z.record(z.string().min(1).max(12), breakdownSchema).refine((r) => Object.keys(r).length <= MAX_FUNDS, "Too many funds");

const durationsSchema = z
  .record(z.string().min(1).max(12), z.object({ years: z.number().finite().min(0).max(60).nullable(), checkedAt: isoTime }))
  .refine((r) => Object.keys(r).length <= MAX_FUNDS, "Too many funds");

// Stocks Claude was asked the sector of, by ticker: when (so a stock it found nothing for is asked again only after a week).
const triesSchema = z.record(z.string().min(1).max(12), isoTime).refine((r) => Object.keys(r).length <= MAX_FUNDS, "Too many funds");

const storedHolding = z.object({
  id: z.string().min(1),
  ticker: z.string().min(1).max(12),
  name: z.string(),
  assetClass: z.enum(HOLDING_CLASSES),
  sector: z.string().nullable(),
  subtype: z.string().nullable(),
  shares: z.number().finite().positive(),
  costBasisPerShare: money,
  currentPrice: money,
  noLivePrice: z.boolean().default(false),
  // Added after v1.0: older saved portfolios have none, so it defaults to "not known".
  country: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
});

const storedDoc = z.object({
  version: z.literal(DOC_VERSION),
  holdings: z.array(storedHolding).max(MAX_HOLDINGS),
  cash: cashAmount,
  isDemoData: z.boolean(),
  seeded: z.boolean(),
  pricesUpdatedAt: isoTime.nullable(),
  learnedFunds: z.array(fundSchema).max(MAX_FUNDS),
  // Added after v1.1: older saved portfolios have none, so it defaults to "nothing looked up yet". It is only a
  // saved copy of provider data, so if it is ever damaged it is dropped (and looked up again), never the portfolio.
  etfBreakdowns: breakdownsSchema.catch({}),
  // Added after v1.3: older saved portfolios have none. Like the fund weights it is only looked-up data: if damaged it is dropped.
  durations: durationsSchema.catch({}),
  // Added after v1.4: older saved portfolios have none. Looked-up bookkeeping only: if damaged it is dropped, never the portfolio.
  sectorTries: triesSchema.catch({}),
});

/** Parse what the browser had saved. Returns null for anything missing, damaged or from an unknown version. */
export function parseStoredDoc(raw: string | null): PortfolioDoc | null {
  if (!raw) return null;
  try {
    const parsed = storedDoc.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as PortfolioDoc) : null;
  } catch {
    return null;
  }
}

// ---- Backup file ----

const backupFile = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: isoTime.optional(),
  cash: cashAmount,
  pricesUpdatedAt: isoTime.nullable().optional(),
  holdings: z.array(z.unknown()).max(MAX_HOLDINGS),
  learnedFunds: z.array(fundSchema).max(MAX_FUNDS).optional(),
  etfBreakdowns: breakdownsSchema.catch({}),
  durations: durationsSchema.catch({}),
  sectorTries: triesSchema.catch({}),
});

/** The text of a backup file for this portfolio. */
export function exportBackup(doc: PortfolioDoc, now: Date): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      cash: doc.cash,
      pricesUpdatedAt: doc.pricesUpdatedAt,
      holdings: doc.holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        assetClass: h.assetClass,
        sector: h.sector,
        subtype: h.subtype,
        shares: h.shares,
        costBasisPerShare: h.costBasisPerShare,
        currentPrice: h.currentPrice,
        noLivePrice: h.noLivePrice ?? false,
        country: h.country ?? null,
      })),
      learnedFunds: doc.learnedFunds,
      etfBreakdowns: doc.etfBreakdowns,
      durations: doc.durations,
      sectorTries: doc.sectorTries,
    },
    null,
    2,
  );
}

export type RestoreResult = { ok: true; doc: PortfolioDoc } | { ok: false; error: string };

/** Check a backup file's text and turn it into a portfolio (new ids, never marked as demo data). */
export function parseBackup(text: string, newId: () => string = () => globalThis.crypto.randomUUID()): RestoreResult {
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: "That file is too large to be a portfolio backup." };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn’t a portfolio backup (it couldn’t be read)." };
  }
  const file = backupFile.safeParse(json);
  if (!file.success) return { ok: false, error: "That file isn’t a Portfolio Analyzer backup." };

  const holdings: PortfolioDoc["holdings"] = [];
  const seen = new Set<string>();
  for (const [i, raw] of file.data.holdings.entries()) {
    const h = holdingSchema.safeParse(raw);
    if (!h.success) return { ok: false, error: `Holding ${i + 1} in the backup isn’t valid: ${h.error.issues[0].message}.` };
    const k = `${h.data.assetClass}:${h.data.ticker}`;
    if (seen.has(k)) return { ok: false, error: `${h.data.ticker} appears twice in ${h.data.assetClass} in the backup.` };
    seen.add(k);
    const flag = (raw as { noLivePrice?: unknown }).noLivePrice === true;
    holdings.push({
      id: newId(),
      ticker: h.data.ticker,
      name: h.data.name,
      assetClass: h.data.assetClass,
      sector: h.data.sector,
      subtype: h.data.subtype,
      shares: h.data.shares,
      costBasisPerShare: h.data.costBasisPerShare,
      currentPrice: h.data.currentPrice,
      noLivePrice: flag,
      country: h.data.country,
    });
  }
  const learnedFunds: FundRecord[] = file.data.learnedFunds ?? [];
  return {
    ok: true,
    doc: {
      version: DOC_VERSION,
      holdings,
      cash: file.data.cash,
      isDemoData: false,
      seeded: true,
      pricesUpdatedAt: file.data.pricesUpdatedAt ?? null,
      learnedFunds,
      etfBreakdowns: file.data.etfBreakdowns,
      durations: file.data.durations,
      sectorTries: file.data.sectorTries,
    },
  };
}
