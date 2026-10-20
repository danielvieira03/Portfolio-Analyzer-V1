"use client";

import { useEffect } from "react";
import { getBrowserStore } from "@/lib/storage/browser";
import { fillMissingDurations } from "@/lib/storage/duration-fill";

/** Wait for a change (import, new holding, restored backup) to settle before looking anything up. */
const SETTLE_MS = 1500;

/**
 * Keeps every bond fund's duration filled in: when the portfolio changes and a bond fund has no duration, Claude looks it
 * up and the answer is saved in this browser. Shows nothing; most of the time (funds in the built-in library) it does nothing.
 */
export function DurationAutoFill() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void fillMissingDurations(), SETTLE_MS);
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
