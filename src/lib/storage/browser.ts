// The one portfolio store of this browser, and the actions the screens call to change it.
// BROWSER ONLY: it uses window.localStorage, so never import it from server code.

import { fillSubtypes, importHoldings, addHolding, clearDemo, removeHolding, saveHolding, setCash } from "@/lib/portfolio/ledger";
import type { AddOutcome, DuplicateChoice, ImportDuplicateChoice, ImportResult } from "@/lib/portfolio/ledger";
import type { HoldingInput } from "@/lib/holdings/schema";
import { createPortfolioStore, type PortfolioStore, type StorageLike } from "./portfolio-store";

let store: PortfolioStore | null = null;

export function getBrowserStore(): PortfolioStore {
  if (typeof window === "undefined") throw new Error("The portfolio store only exists in the browser.");
  if (!store) {
    let storage: StorageLike | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null; // blocked by the browser: the store falls back to memory
    }
    store = createPortfolioStore(storage);
  }
  return store;
}

// ---- The changes the screens make ----

export function addHoldingToPortfolio(input: HoldingInput, onDuplicate?: DuplicateChoice): AddOutcome {
  let outcome: AddOutcome = "added";
  getBrowserStore().update((doc) => {
    const r = addHolding(doc, input, onDuplicate);
    outcome = r.outcome;
    return r.doc;
  });
  return outcome;
}

export function saveHoldingInPortfolio(id: string, input: HoldingInput): { ok: true } | { ok: false; error: "duplicate" | "not_found" } {
  let result: { ok: true } | { ok: false; error: "duplicate" | "not_found" } = { ok: true };
  getBrowserStore().update((doc) => {
    const r = saveHolding(doc, id, input);
    if (!r.ok) {
      result = r;
      return doc;
    }
    return r.doc;
  });
  return result;
}

export function removeHoldingFromPortfolio(id: string): void {
  getBrowserStore().update((doc) => removeHolding(doc, id));
}

export function setCashInPortfolio(amount: number): void {
  getBrowserStore().update((doc) => setCash(doc, amount));
}

export function clearDemoPortfolio(): void {
  getBrowserStore().update(clearDemo);
}

export function importIntoPortfolio(
  mode: "add" | "replace",
  holdings: HoldingInput[],
  cashAmount?: number,
  onDuplicate: ImportDuplicateChoice = "skip",
): ImportResult {
  let result: ImportResult = { added: 0, merged: 0, replaced: 0, skipped: 0 };
  getBrowserStore().update((doc) => {
    const r = importHoldings(doc, mode, holdings, cashAmount, onDuplicate);
    result = r.result;
    return r.doc;
  });
  return result;
}

/** Fill in maturity / type found by a lookup (keyed "Asset Class:TICKER"). Returns how many holdings changed. */
export function fillSubtypesInPortfolio(found: Record<string, string>): number {
  let updated = 0;
  getBrowserStore().update((doc) => {
    const r = fillSubtypes(doc, found);
    updated = r.updated;
    return r.doc;
  });
  return updated;
}
