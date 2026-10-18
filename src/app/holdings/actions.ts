"use server";

import { revalidatePath } from "next/cache";
import { getFunds } from "@/data/funds.repo";
import { addHolding, applyPrices, deleteHolding, fillSubtypes, getPriceTargets, getPricesUpdatedAt, importHoldings, saveHolding, setCash, type DuplicateChoice, type ImportDuplicateChoice, type ImportResult } from "@/data/holdings.repo";
import { hasSubtype, isValidSubtype } from "@/config/subtypes";
import { PRICE_REFRESH_MINUTES } from "@/config/market";
import { cashSchema, fieldErrors, holdingSchema } from "@/lib/holdings/schema";
import { fetchProfiles, type FetchStatus } from "@/lib/market/fmp";
import { equitySector } from "@/lib/market/profile";
import { isStale, planPriceUpdates } from "@/lib/market/refresh-plan";

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; errors: Record<string, string>; /** Adding a ticker that already exists — ask the user what to do. */ duplicate?: true };

const refresh = () => revalidatePath("/", "layout");

/**
 * Create (id = null) or update a holding. When creating a ticker that already exists in the
 * class, returns { duplicate: true } until the caller picks "merge" or "replace".
 */
export async function saveHoldingAction(
  id: string | null,
  values: unknown,
  onDuplicate?: DuplicateChoice,
): Promise<ActionResult> {
  const parsed = holdingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const exists = {
    ok: false as const,
    errors: { ticker: `${parsed.data.ticker} already exists in ${parsed.data.assetClass}` },
  };
  try {
    if (id) await saveHolding(id, parsed.data);
    else if ((await addHolding(parsed.data, onDuplicate)) === "duplicate") return { ...exists, duplicate: true };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return exists; // edited into a colliding ticker
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function removeHoldingAction(id: string): Promise<ActionResult> {
  await deleteHolding(id);
  refresh();
  return { ok: true };
}

export async function saveCashAction(amount: number): Promise<ActionResult> {
  const parsed = cashSchema.safeParse({ amount });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await setCash(parsed.data.amount);
  refresh();
  return { ok: true };
}

export async function importHoldingsAction(
  mode: "add" | "replace",
  holdings: unknown[],
  cashAmount?: number,
  onDuplicate: ImportDuplicateChoice = "skip",
): Promise<ActionResult<ImportResult>> {
  const valid = [];
  for (const h of holdings) {
    const parsed = holdingSchema.safeParse(h);
    if (!parsed.success) return { ok: false, errors: { form: "Some rows are invalid — please re-check the file." } };
    valid.push(parsed.data);
  }
  const result = await importHoldings(mode, valid, cashAmount, onDuplicate);
  refresh();
  return { ok: true, ...result };
}

/** Save maturities/types found by the Claude lookup (keyed "Asset Class:TICKER"). Only fills empty values. */
export async function saveSubtypesAction(found: Record<string, string>): Promise<ActionResult<{ updated: number }>> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(found)) {
    const assetClass = key.slice(0, key.indexOf(":"));
    if (isValidSubtype(assetClass, value)) clean[key] = value;
  }
  const updated = await fillSubtypes(clean);
  refresh();
  return { ok: true, updated };
}

// ---- Market data (prices and autofill) ----

export interface PriceRefreshResult {
  /** "fresh" = prices were recent enough, nothing was fetched. */
  status: "fresh" | "updated" | FetchStatus;
  updated: number;
  /** Holdings the API had no price for (they keep their manual price). */
  unavailable: number;
}

// Two tabs asking at once share one run instead of calling the API twice.
let inFlight: Promise<PriceRefreshResult> | null = null;

async function runPriceRefresh(force: boolean): Promise<PriceRefreshResult> {
  if (!force && !isStale(await getPricesUpdatedAt(), new Date(), PRICE_REFRESH_MINUTES)) {
    return { status: "fresh", updated: 0, unavailable: 0 };
  }
  const targets = await getPriceTargets();
  if (targets.length === 0) return { status: "fresh", updated: 0, unavailable: 0 };

  const result = await fetchProfiles(targets.map((t) => t.ticker));
  const plan = planPriceUpdates(targets, result.profiles);
  if (plan.found.length > 0 || plan.missing.length > 0) {
    await applyPrices(plan, plan.found.length > 0);
    refresh();
  }
  const status = result.status === "ok" ? "updated" : result.status;
  return { status, updated: plan.found.length, unavailable: plan.missing.length };
}

/**
 * Refresh every holding's price from the market data API. Without `force` it does nothing when
 * the last refresh is newer than PRICE_REFRESH_MINUTES (so the automatic hourly check is cheap).
 */
export async function refreshPricesAction(force: boolean): Promise<PriceRefreshResult> {
  inFlight ??= runPriceRefresh(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export interface TickerLookup {
  found: boolean;
  name?: string;
  price?: number;
  /** Equities form only: the stock's sector, or "Diversified" for an ETF. Never for bonds or alternatives. */
  sector?: string;
  /** Maturity (Fixed Income form) or type (Alternatives form), only when the fund library knows the fund. Free. */
  subtype?: string;
}

/** One-ticker lookup for the Add/Edit form. Never throws: no data simply means "enter it by hand". */
export async function lookupTickerAction(ticker: string, assetClass: string): Promise<TickerLookup> {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.^=\-]{1,12}$/.test(t)) return { found: false };
  const { profiles } = await fetchProfiles([t]);
  const profile = profiles.get(t);
  const sector = assetClass === "Equities" ? equitySector(profile ?? null) : null;
  // The fund library answers maturity / type for free (no Claude call).
  const fund = hasSubtype(assetClass) ? (await getFunds([t])).find((f) => f.assetClass === assetClass) : undefined;
  if (!profile && !fund) return { found: false };
  return {
    found: true,
    ...(profile ? { name: profile.name, price: profile.price } : {}),
    ...(sector ? { sector } : {}),
    ...(fund ? { subtype: fund.subtype } : {}),
  };
}
