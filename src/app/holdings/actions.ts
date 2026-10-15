"use server";

import { revalidatePath } from "next/cache";
import { addHolding, deleteHolding, importHoldings, saveHolding, setCash, type DuplicateChoice, type ImportResult } from "@/data/holdings.repo";
import { cashSchema, fieldErrors, holdingSchema } from "@/lib/holdings/schema";

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
): Promise<ActionResult<ImportResult>> {
  const valid = [];
  for (const h of holdings) {
    const parsed = holdingSchema.safeParse(h);
    if (!parsed.success) return { ok: false, errors: { form: "Some rows are invalid — please re-check the file." } };
    valid.push(parsed.data);
  }
  const result = await importHoldings(mode, valid, cashAmount);
  refresh();
  return { ok: true, ...result };
}
