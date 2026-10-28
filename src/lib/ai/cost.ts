// What a chat question cost, estimated from the usage numbers Claude reports. Pure; prices live in `CHAT_PRICES` (src/config/ai.ts).

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  searches: number;
}

export interface ChatPrices {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWriteFactor: number;
  cacheReadFactor: number;
  perSearch: number;
}

export const noUsage = (): ChatUsage => ({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, searches: 0 });

export const addUsage = (a: ChatUsage, b: ChatUsage): ChatUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  searches: a.searches + b.searches,
});

/** Estimated dollars: normal input at the input price, cache writes and reads at their factors of it, output, and each search. */
export function estimateCost(u: ChatUsage, p: ChatPrices): number {
  const input = (u.inputTokens + u.cacheWriteTokens * p.cacheWriteFactor + u.cacheReadTokens * p.cacheReadFactor) * p.inputPerMillion;
  return (input + u.outputTokens * p.outputPerMillion) / 1_000_000 + u.searches * p.perSearch;
}
