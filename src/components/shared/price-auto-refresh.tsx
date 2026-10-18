"use client";

import { useEffect } from "react";
import { PRICE_REFRESH_MINUTES } from "@/config/market";
import { checkEveryMs } from "@/lib/market/refresh-plan";
import { refreshPrices } from "@/lib/storage/browser-refresh";

/** How often this page asks whether prices are due. The refresh itself only runs when they are (PRICE_REFRESH_MINUTES). */
const CHECK_EVERY_MS = checkEveryMs(PRICE_REFRESH_MINUTES);

/**
 * Keeps prices fresh while the app is open: checks once on load, then several times per interval. A check is a cheap
 * no-op unless this browser's prices are PRICE_REFRESH_MINUTES old or older, so refreshes land on
 * schedule. Shows nothing; failures are silent (the Holdings tab has the Refresh button and a status line).
 */
export function PriceAutoRefresh() {
  useEffect(() => {
    const run = () => {
      refreshPrices(false).catch(() => {});
    };
    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
