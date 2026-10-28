"use client";

import { useEffect, useState } from "react";
import { FALLBACK_BENCHMARK, type Benchmark } from "@/lib/market/benchmark";
import { benchmarkDue, fetchBenchmark, loadBenchmark } from "@/lib/storage/benchmark-store";

/**
 * The S&P 500 sector benchmark: SPY's weights, looked up about once a week and saved in this browser. Starts with the built-in copy
 * (so the first paint never waits), switches to the saved copy at once, and quietly asks for fresh weights when the saved ones are
 * a week old. If the lookup fails the saved (or built-in) copy simply stays.
 */
export function useBenchmark(): Benchmark {
  const [benchmark, setBenchmark] = useState<Benchmark>(FALLBACK_BENCHMARK);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      const saved = loadBenchmark();
      if (saved && live) setBenchmark(saved);
      if (!benchmarkDue(saved)) return;
      const fresh = await fetchBenchmark();
      if (fresh && live) setBenchmark(fresh);
    };
    void refresh();
    return () => {
      live = false;
    };
  }, []);
  return benchmark;
}
