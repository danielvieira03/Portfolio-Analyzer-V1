// All the rules for changing a saved portfolio, as pure functions: each takes the stored portfolio
// and returns a new one. No browser, no database, so every rule is unit-tested. The browser store
// (src/lib/storage) saves the result. These rules are ported from the old server database code.

import { DEMO_CASH, DEMO_HOLDINGS } from "@/config/demo-portfolio";
import { FUND_LIBRARY } from "@/config/fund-library";
import { isValidSubtype } from "@/config/subtypes";
import type { HoldingInput } from "@/lib/holdings/schema";
import type { FundRecord } from "@/lib/funds/library";
import type { PricePlan } from "@/lib/market/refresh-plan";
import { mergePositions } from "./calc";
import type { Position } from "./types";

export const DOC_VERSION = 1;

/** Everything one visitor has saved. */
export interface PortfolioDoc {
  version: typeof DOC_VERSION;
  holdings: Position[];
  cash: number;
  /** True while the portfolio is still the untouched demo. */
  isDemoData: boolean;
  /** The demo has been offered once; clearing it never brings it back. */
  seeded: boolean;
  /** ISO time of the last price refresh; null = never. */
  pricesUpdatedAt: string | null;
  /** Funds Claude looked up for this visitor (added to the built-in fund library). */
  learnedFunds: FundRecord[];
}

type IdMaker = () => string;
const defaultId: IdMaker = () => globalThis.crypto.randomUUID();

const key = (assetClass: string, ticker: string) => `${assetClass}:${ticker}`;
const sameFund = (a: { assetClass: string; ticker: string }, b: { assetClass: string; ticker: string }) =>
  a.assetClass === b.assetClass && a.ticker === b.ticker;

/** Any edit by the user means the portfolio is no longer pure demo data. */
const leaveDemo = (doc: PortfolioDoc): PortfolioDoc => (doc.isDemoData ? { ...doc, isDemoData: false } : doc);

const fromInput = (h: HoldingInput, id: string, noLivePrice = false): Position => ({
  id,
  ticker: h.ticker,
  name: h.name,
  assetClass: h.assetClass,
  sector: h.sector,
  subtype: h.subtype,
  shares: h.shares,
  costBasisPerShare: h.costBasisPerShare,
  currentPrice: h.currentPrice,
  noLivePrice,
});

/** The portfolio of someone who has never been here: the demo portfolio. */
export function newVisitorDoc(newId: IdMaker = defaultId): PortfolioDoc {
  return {
    version: DOC_VERSION,
    holdings: DEMO_HOLDINGS.map((h) => ({
      id: newId(),
      ticker: h.ticker,
      name: h.name,
      assetClass: h.assetClass,
      sector: h.sector,
      subtype: h.subtype ?? null,
      shares: h.shares,
      costBasisPerShare: h.cost,
      currentPrice: h.price,
      noLivePrice: false,
    })),
    cash: DEMO_CASH,
    isDemoData: true,
    seeded: true,
    pricesUpdatedAt: null,
    learnedFunds: [],
  };
}

/** Remove every holding and zero the cash. The demo is never offered again. */
export function clearDemo(doc: PortfolioDoc): PortfolioDoc {
  return { ...doc, holdings: [], cash: 0, isDemoData: false };
}

export type AddOutcome = "added" | "merged" | "replaced" | "duplicate";
export type DuplicateChoice = "merge" | "replace";

/**
 * Add a new holding. If the ticker already exists in that class nothing changes ("duplicate")
 * unless the caller says whether to merge (average into the existing position) or replace it.
 */
export function addHolding(
  doc: PortfolioDoc,
  input: HoldingInput,
  onDuplicate?: DuplicateChoice,
  newId: IdMaker = defaultId,
): { doc: PortfolioDoc; outcome: AddOutcome } {
  const existing = doc.holdings.find((h) => sameFund(h, input));
  if (!existing) {
    return { doc: leaveDemo({ ...doc, holdings: [...doc.holdings, fromInput(input, newId())] }), outcome: "added" };
  }
  if (!onDuplicate) return { doc, outcome: "duplicate" };
  const updated: Position =
    onDuplicate === "replace"
      ? { ...fromInput(input, existing.id), noLivePrice: existing.noLivePrice }
      : { ...existing, ...mergePositions(existing, input) };
  return {
    doc: leaveDemo({ ...doc, holdings: doc.holdings.map((h) => (h.id === existing.id ? updated : h)) }),
    outcome: onDuplicate === "replace" ? "replaced" : "merged",
  };
}

/** Edit a holding. Fails if the new ticker collides with another holding in the same class. */
export function saveHolding(
  doc: PortfolioDoc,
  id: string,
  input: HoldingInput,
): { ok: true; doc: PortfolioDoc } | { ok: false; error: "duplicate" | "not_found" } {
  const current = doc.holdings.find((h) => h.id === id);
  if (!current) return { ok: false, error: "not_found" };
  if (doc.holdings.some((h) => h.id !== id && sameFund(h, input))) return { ok: false, error: "duplicate" };
  const updated = fromInput(input, id, current.noLivePrice);
  return { ok: true, doc: leaveDemo({ ...doc, holdings: doc.holdings.map((h) => (h.id === id ? updated : h)) }) };
}

export function removeHolding(doc: PortfolioDoc, id: string): PortfolioDoc {
  return leaveDemo({ ...doc, holdings: doc.holdings.filter((h) => h.id !== id) });
}

export function setCash(doc: PortfolioDoc, amount: number): PortfolioDoc {
  return leaveDemo({ ...doc, cash: amount });
}

export interface ImportResult {
  added: number;
  merged: number;
  replaced: number;
  skipped: number;
}
export type ImportDuplicateChoice = "skip" | DuplicateChoice;

/**
 * Save imported holdings. "add" keeps everything already there; for tickers that already exist in the
 * same class, `onDuplicate` decides: skip them, average them into the existing position (merge), or
 * overwrite it (replace). "replace" wipes the current holdings first. A cash amount from the file is
 * added to (add) or replaces (replace) the cash balance.
 */
export function importHoldings(
  doc: PortfolioDoc,
  mode: "add" | "replace",
  incoming: HoldingInput[],
  cashAmount?: number,
  onDuplicate: ImportDuplicateChoice = "skip",
  newId: IdMaker = defaultId,
): { doc: PortfolioDoc; result: ImportResult } {
  const result: ImportResult = { added: 0, merged: 0, replaced: 0, skipped: 0 };
  let holdings = mode === "replace" ? [] : [...doc.holdings];

  for (const h of incoming) {
    const at = holdings.findIndex((x) => sameFund(x, h));
    if (at === -1) {
      holdings.push(fromInput(h, newId()));
      result.added++;
    } else if (onDuplicate === "skip") {
      result.skipped++;
    } else if (onDuplicate === "replace") {
      holdings[at] = { ...fromInput(h, holdings[at].id), noLivePrice: holdings[at].noLivePrice };
      result.replaced++;
    } else {
      holdings[at] = { ...holdings[at], ...mergePositions(holdings[at], h) };
      result.merged++;
    }
  }
  holdings = [...holdings];

  const cash = cashAmount === undefined ? doc.cash : mode === "add" ? doc.cash + cashAmount : cashAmount;
  return { doc: leaveDemo({ ...doc, holdings, cash }), result };
}

/**
 * Save refreshed prices: found prices replace the old ones (and clear the "manual" flag); holdings the
 * market data had no price for keep their price and get flagged. `now` is recorded as the refresh time
 * when `stamp` is true. Refreshing prices never changes whether the portfolio counts as demo data.
 */
export function applyPrices(doc: PortfolioDoc, plan: PricePlan, stamp: boolean, now: Date): PortfolioDoc {
  const found = new Map(plan.found.map((f) => [f.id, f.price]));
  const missing = new Set(plan.missing);
  return {
    ...doc,
    holdings: doc.holdings.map((h) =>
      found.has(h.id)
        ? { ...h, currentPrice: found.get(h.id)!, noLivePrice: false }
        : missing.has(h.id)
          ? { ...h, noLivePrice: true }
          : h,
    ),
    pricesUpdatedAt: stamp ? now.toISOString() : doc.pricesUpdatedAt,
  };
}

/**
 * Fill in maturity / type for holdings that have none yet. `found` is keyed "Asset Class:TICKER".
 * Values already set are never overwritten and values not allowed for the class are ignored.
 */
export function fillSubtypes(doc: PortfolioDoc, found: Record<string, string>): { doc: PortfolioDoc; updated: number } {
  let updated = 0;
  const holdings = doc.holdings.map((h) => {
    const value = found[key(h.assetClass, h.ticker)];
    if (h.subtype || !value || !isValidSubtype(h.assetClass, value)) return h;
    updated++;
    return { ...h, subtype: value };
  });
  return { doc: updated > 0 ? { ...doc, holdings } : doc, updated };
}

// ---- Fund library: the built-in list plus funds Claude looked up for this visitor ----

const BUILTIN_FUNDS: FundRecord[] = FUND_LIBRARY.map((f) => ({
  ticker: f.ticker,
  name: f.name,
  assetClass: f.assetClass,
  subtype: f.subtype,
  durationYears: f.duration ?? null,
}));

/** The library entries (built-in first, then learned) for these tickers. */
export function libraryFunds(doc: PortfolioDoc, tickers: string[]): FundRecord[] {
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  const seen = new Set<string>();
  const out: FundRecord[] = [];
  for (const f of [...BUILTIN_FUNDS, ...doc.learnedFunds]) {
    const t = f.ticker.toUpperCase();
    if (!wanted.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(f);
  }
  return out;
}

/** Remember funds Claude looked up. An existing entry (built-in or learned) is never overwritten. */
export function addLearnedFunds(doc: PortfolioDoc, funds: FundRecord[]): PortfolioDoc {
  const have = new Set([...BUILTIN_FUNDS, ...doc.learnedFunds].map((f) => f.ticker.toUpperCase()));
  const fresh: FundRecord[] = [];
  for (const f of funds) {
    const t = f.ticker.toUpperCase();
    if (have.has(t)) continue;
    have.add(t);
    fresh.push({ ...f, ticker: t });
  }
  return fresh.length > 0 ? { ...doc, learnedFunds: [...doc.learnedFunds, ...fresh] } : doc;
}
