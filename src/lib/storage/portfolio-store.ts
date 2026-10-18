// Keeps one visitor's portfolio in their own browser. Nothing here touches a server.
//
// The browser's storage is passed in (window.localStorage in the app, a fake in tests), so this is
// testable without a browser. It works with React's useSyncExternalStore: `getSnapshot` returns the
// same object until the portfolio really changes.

import { parseStoredDoc } from "@/lib/portfolio/document";
import { newVisitorDoc, type PortfolioDoc } from "@/lib/portfolio/ledger";

export const STORAGE_KEY = "portfolio-analyzer:v1";
/** A copy of saved data we couldn't read is kept here instead of being thrown away. */
export const CORRUPT_KEY = "portfolio-analyzer:v1:unreadable";

/** The part of the browser's storage we use. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StoreStatus =
  | "ok"
  /** Saved data was damaged: we started fresh and kept a copy of the damaged text. */
  | "recovered"
  /** The browser won't let us save (private mode, blocked storage): changes last until the tab closes. */
  | "memory-only";

export interface StoreState {
  doc: PortfolioDoc;
  status: StoreStatus;
}

export interface PortfolioStore {
  getSnapshot(): StoreState;
  subscribe(listener: () => void): () => void;
  /** Change the portfolio. `fn` gets the current one and returns the new one (see ledger.ts). */
  update(fn: (doc: PortfolioDoc) => PortfolioDoc): void;
  /** Replace the whole portfolio (used when restoring a backup). */
  replace(doc: PortfolioDoc): void;
  /** Re-read the browser's storage (used when another tab changed it). */
  reload(): void;
  /** Hide the "we had to start fresh" notice once the visitor has seen it. */
  dismissNotice(): void;
}

export function createPortfolioStore(storage: StorageLike | null): PortfolioStore {
  let memoryOnly = storage === null;
  const listeners = new Set<() => void>();
  let status: StoreStatus = "ok";

  const write = (doc: PortfolioDoc) => {
    if (memoryOnly || !storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      memoryOnly = true; // quota or blocked: keep working in memory
    }
  };

  const load = (): { doc: PortfolioDoc; status: StoreStatus } => {
    if (!storage) return { doc: newVisitorDoc(), status: "memory-only" };
    let raw: string | null = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      memoryOnly = true;
      return { doc: newVisitorDoc(), status: "memory-only" };
    }
    if (raw === null) {
      // First visit: start with the demo portfolio and save it.
      const doc = newVisitorDoc();
      write(doc);
      return { doc, status: memoryOnly ? "memory-only" : "ok" };
    }
    const doc = parseStoredDoc(raw);
    if (doc) return { doc, status: "ok" };
    // Damaged: keep a copy of what was there, then start fresh.
    try {
      storage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* nothing more we can do */
    }
    const fresh = newVisitorDoc();
    write(fresh);
    return { doc: fresh, status: memoryOnly ? "memory-only" : "recovered" };
  };

  let state: StoreState = (() => {
    const loaded = load();
    status = loaded.status;
    return { doc: loaded.doc, status };
  })();

  const publish = (doc: PortfolioDoc, nextStatus: StoreStatus = status) => {
    status = memoryOnly && nextStatus === "ok" ? "memory-only" : nextStatus;
    state = { doc, status };
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      const next = fn(state.doc);
      if (next === state.doc) return;
      write(next);
      publish(next);
    },
    replace(doc) {
      write(doc);
      publish(doc);
    },
    reload() {
      const loaded = load();
      if (JSON.stringify(loaded.doc) === JSON.stringify(state.doc) && loaded.status === state.status) return;
      publish(loaded.doc, loaded.status);
    },
    dismissNotice() {
      if (state.status === "recovered") publish(state.doc, "ok");
    },
  };
}
