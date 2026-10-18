// Price refresh for this browser's portfolio. BROWSER ONLY (it uses the browser store).

import { fetchPricesAction } from "@/app/holdings/actions";
import { getBrowserStore } from "./browser";
import { onceAtATime, runPriceRefresh, type PriceRefreshResult } from "./price-refresh";

/** Refresh prices now (force) or only if they are due. Simultaneous callers share one run. */
export const refreshPrices: (force: boolean) => Promise<PriceRefreshResult> = onceAtATime((force: boolean) =>
  runPriceRefresh(force, { store: getBrowserStore(), fetchPrices: fetchPricesAction }),
);

export type { PriceRefreshResult };
