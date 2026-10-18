"use client";

import { useSyncExternalStore } from "react";
import { getBrowserStore } from "@/lib/storage/browser";
import type { StoreState } from "@/lib/storage/portfolio-store";

const subscribe = (listener: () => void) => getBrowserStore().subscribe(listener);
const getSnapshot = () => getBrowserStore().getSnapshot();
// On the server (and during the first paint in the browser) there is no portfolio yet.
const getServerSnapshot = (): StoreState | null => null;

/**
 * This visitor's portfolio, read from their own browser. Returns null until it has been read
 * (the page shows a short loading state), then the portfolio and the storage status.
 */
export function usePortfolio(): StoreState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
