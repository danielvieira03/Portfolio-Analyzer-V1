// Looks up a fund's maturity (bonds) or type (alternatives) with Claude + web search.
// SERVER ONLY (uses the API key through ./claude).

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AI_MODEL } from "@/config/ai";
import { ALT_TYPES, MATURITIES, MATURITY_HELP, SUBTYPE_FALLBACK, isValidSubtype, type SubtypeClass } from "@/config/subtypes";
import { AiError, getClient, toAiError, type AiUsage } from "./claude";

export interface ClassifyItem {
  ticker: string;
  name: string;
  assetClass: SubtypeClass;
}

/** Claude's answer if it is one of the allowed values for the class, otherwise the "unknown" value. */
export const checkSubtype = (assetClass: SubtypeClass, value: string) =>
  isValidSubtype(assetClass, value) ? value : SUBTYPE_FALLBACK[assetClass];

export const classifyKey = (assetClass: string, ticker: string) => `${assetClass}:${ticker}`;

const resultSchema = z.object({
  results: z.array(
    z.object({
      ticker: z.string(),
      assetClass: z.enum(["Fixed Income", "Alternatives"]),
      subtype: z.string().describe("Exactly one of the allowed values for this asset class"),
      durationYears: z
        .number()
        .nullable()
        .describe("Fixed Income only: the fund's average or effective duration in years, if the page states it; otherwise null"),
      basis: z.string().describe("One short phrase: what you found and where"),
    }),
  ),
});
export type ClassifyResults = z.infer<typeof resultSchema>["results"];

const SYSTEM = `You classify investment funds for a portfolio tracker. You MUST run a web search for every holding before answering (find the issuer's page, factsheet or a fund-data site and read its average maturity / category); never answer from memory. Then pick ONE value per holding.

Fixed Income holdings get a maturity: ${MATURITIES.join(", ")}.
${MATURITY_HELP} Use the fund's average maturity or duration. Use "Not specified" only if the fund spans very different maturities with no clear centre, or you cannot find it.

Alternatives holdings get a type: ${ALT_TYPES.join(", ")}.
Commodities = gold, silver, oil, metals, agriculture or broad commodity funds. REITs = real estate funds. Crypto = bitcoin/ether and other crypto trusts or ETFs. Infrastructure = infrastructure funds. Other = anything else (hedge-fund style, managed futures, private equity...).

For Fixed Income holdings also report the fund's average or effective duration in years (a number such as 6.2) if the page you read states it; otherwise null. Never estimate it.

Return one result per holding, using the exact ticker and asset class you were given and one of the allowed values. If a search fails or you cannot read any result for a holding, leave that holding OUT of the results (it will be retried later) instead of guessing. Never invent facts: if you read the fund's page but it does not say, answer "${SUBTYPE_FALLBACK["Fixed Income"]}" (Fixed Income) or "${SUBTYPE_FALLBACK.Alternatives}" (Alternatives).`;

const BATCH_SIZE = 5;
const MAX_BATCHES_PER_CALL = 4;
const MAX_PAUSES = 3;

async function lookupBatch(items: ClassifyItem[]): Promise<{ results: ClassifyResults; usage: AiUsage; searches: number }> {
  const client = getClient();
  const messages: Parameters<typeof client.beta.messages.parse>[0]["messages"] = [
    {
      role: "user",
      content: `Classify these holdings (JSON):\n${JSON.stringify(items)}`,
    },
  ];
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;

  for (let turn = 0; turn <= MAX_PAUSES; turn++) {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.max(4, items.length * 3) }],
      output_config: { effort: "low", format: zodOutputFormat(resultSchema) },
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    searches += response.usage.server_tool_use?.web_search_requests ?? response.content.filter((b) => b.type === "server_tool_use").length;

    if (response.stop_reason === "refusal") throw new AiError("refused", "Claude declined to look these up.");
    if (response.stop_reason === "pause_turn") {
      // The search tool paused a long turn; hand the partial answer back so Claude can continue.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (!response.parsed_output) throw new AiError("failed", "Claude’s answer couldn’t be understood. Please try again.");
    return { results: response.parsed_output.results, usage: { inputTokens, outputTokens }, searches };
  }
  throw new AiError("failed", "The lookup took too long. Please try again.");
}

/**
 * Find the maturity / type of each holding. Returns a map keyed by "Asset Class:TICKER".
 * Holdings Claude gave no usable answer for are left out (so they can be tried again later);
 * an answer that isn't one of the allowed values is stored as "Not specified" / "Other".
 */
export async function lookupSubtypes(
  items: ClassifyItem[],
): Promise<{ found: Record<string, string>; durations: Record<string, number>; usage: AiUsage; searches: number }> {
  const wanted = items.slice(0, BATCH_SIZE * MAX_BATCHES_PER_CALL);
  const found: Record<string, string> = {};
  const durations: Record<string, number> = {};
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
  let searches = 0;
  try {
    for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
      const batch = wanted.slice(i, i + BATCH_SIZE);
      const out = await lookupBatch(batch);
      usage.inputTokens += out.usage.inputTokens;
      usage.outputTokens += out.usage.outputTokens;
      searches += out.searches;
      for (const r of out.results) console.log(`[classify] ${r.assetClass}:${r.ticker} -> ${r.subtype} (${r.basis})`);
      for (const item of batch) {
        const r = out.results.find((x) => x.ticker.toUpperCase() === item.ticker.toUpperCase() && x.assetClass === item.assetClass);
        if (!r) continue;
        found[classifyKey(item.assetClass, item.ticker)] = checkSubtype(item.assetClass, r.subtype);
        if (item.assetClass === "Fixed Income" && typeof r.durationYears === "number" && r.durationYears > 0 && r.durationYears < 50) {
          durations[classifyKey(item.assetClass, item.ticker)] = r.durationYears;
        }
      }
    }
  } catch (e) {
    throw toAiError(e);
  }
  return { found, durations, usage, searches };
}
