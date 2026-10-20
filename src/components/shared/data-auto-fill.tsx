"use client";

import { useEffect } from "react";
import { getBrowserStore } from "@/lib/storage/browser";
import { fillMissingData } from "@/lib/storage/data-fill";

/** Wait for a change (import, new holding, restored backup) to settle before looking anything up. */
const SETTLE_MS = 1500;

/**
 * Keeps the data the Risk Profile needs filled in: when the portfolio changes and a stock has no sector, an equity ETF has no
 * sector weights from the market data, or a bond fund has no duration, Claude looks it up and the answer is saved in this
 * browser. Shows nothing; most of the time (everything known) it does nothing.
 */
export function DataAutoFill() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void fillMissingData(), SETTLE_MS);
    };
    const off = getBrowserStore().subscribe(schedule);
    schedule();
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
