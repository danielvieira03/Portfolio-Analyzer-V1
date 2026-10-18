"use client";

import { useEffect } from "react";
import { refreshPricesAction } from "@/app/holdings/actions";

/** How often this page asks the server whether prices are due. The server decides (PRICE_REFRESH_MINUTES). */
const CHECK_EVERY_MS = 60_000;

/**
 * Keeps prices fresh while the app is open: asks once on load, then every minute. The server only
 * fetches when the last refresh is PRICE_REFRESH_MINUTES old or older, so almost every ask is a
 * cheap no-op and refreshes land right on schedule. Shows nothing; failures are silent (the
 * Holdings tab has the Refresh button and a status line).
 */
export function PriceAutoRefresh() {
  useEffect(() => {
    const run = () => {
      refreshPricesAction(false).catch(() => {});
    };
    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
