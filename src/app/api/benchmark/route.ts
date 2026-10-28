import { BENCHMARK_FUND, BENCHMARK_REFRESH_DAYS, parseBenchmark } from "@/lib/market/benchmark";
import { fetchBenchmarkSectors } from "@/lib/market/fmp";

export const runtime = "nodejs";

const DAY = 86_400;

/**
 * The S&P 500 sector benchmark: SPY's sector weights from the market data provider (one call). Public market data, nothing about any
 * visitor. A good answer is cached by the host's CDN for a week (so the provider is asked about once a week, however many people
 * open the app); a failure is not cached, and the browser then keeps its saved copy or the built-in one.
 */
export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const benchmark = parseBenchmark(await fetchBenchmarkSectors(BENCHMARK_FUND), today);
  if (!benchmark) return Response.json({ ok: false, error: "The S&P 500 sector weights are not available right now." }, { status: 502, headers: { "cache-control": "no-store" } });
  return Response.json(
    { ok: true, ...benchmark },
    { headers: { "cache-control": `public, s-maxage=${BENCHMARK_REFRESH_DAYS * DAY}, stale-while-revalidate=${DAY}` } },
  );
}
