// Reads the sector breakdown of equity ETFs with Claude + web search, for funds the market data has no breakdown for.
// SERVER ONLY (uses the API key through ./claude).

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AI_MODEL } from "@/config/ai";
import { sectorWeightsFromPercents } from "@/lib/market/claude-breakdown";
import { SECTORS } from "@/lib/portfolio/sectors";
import { AiError, getClient, toAiError, type AiUsage } from "./claude";

export interface BreakdownItem {
  ticker: string;
  name: string;
}

const resultSchema = z.object({
  results: z.array(
    z.object({
      ticker: z.string(),
      sectors: z.array(z.object({ sector: z.enum(SECTORS), percent: z.number().describe("Percent of the fund in this sector, as the page shows it (30.5 means 30.5%)") })),
      basis: z.string().describe("One short phrase: which page you read and its date"),
    }),
  ),
});

const SYSTEM = `You read the sector breakdown of equity ETFs for a portfolio tracker. You MUST run a web search for every fund and read the weights from the issuer's page, factsheet or a fund-data site; never answer from memory.

Report the fund's weight in each of these sectors, exactly: ${SECTORS.join(", ")}. If the page uses other names (Technology, Financial Services, Healthcare, Consumer Cyclical, Consumer Defensive, Basic Materials, Communication...) map them to the matching sector above. Use percentages as the page shows them. Leave out cash, derivatives and anything that is not one of these sectors.

If you cannot read a sector table for a fund, leave that fund OUT of the results (it will be tried again later). Never estimate or invent weights. Use the exact ticker you were given.`;

const BATCH_SIZE = 3;
const MAX_PAUSES = 3;

async function lookupBatch(items: BreakdownItem[]): Promise<{ results: z.infer<typeof resultSchema>["results"]; usage: AiUsage; searches: number }> {
  const client = getClient();
  const messages: Parameters<typeof client.beta.messages.parse>[0]["messages"] = [
    { role: "user", content: `Find the sector breakdown of these ETFs (JSON):\n${JSON.stringify(items)}` },
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
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.max(3, items.length * 3) }],
      output_config: { effort: "low", format: zodOutputFormat(resultSchema) },
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    searches += response.usage.server_tool_use?.web_search_requests ?? response.content.filter((b) => b.type === "server_tool_use").length;

    if (response.stop_reason === "refusal") throw new AiError("refused", "Claude declined to look these up.");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (!response.parsed_output) throw new AiError("failed", "Claude’s answer couldn’t be understood. Please try again.");
    return { results: response.parsed_output.results, usage: { inputTokens, outputTokens }, searches };
  }
  throw new AiError("failed", "The lookup took too long. Please try again.");
}

/**
 * Sector weights (fractions) per upper-case ticker. A fund Claude gave no believable answer for (nothing readable, or weights that
 * don't add up to roughly 100%) is left out, so it can be tried again later.
 */
export async function lookupBreakdowns(
  items: BreakdownItem[],
): Promise<{ found: Record<string, { name: string; weight: number }[]>; usage: AiUsage; searches: number }> {
  const wanted = items.slice(0, 10);
  const found: Record<string, { name: string; weight: number }[]> = {};
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
  let searches = 0;
  try {
    for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
      const batch = wanted.slice(i, i + BATCH_SIZE);
      const out = await lookupBatch(batch);
      usage.inputTokens += out.usage.inputTokens;
      usage.outputTokens += out.usage.outputTokens;
      searches += out.searches;
      for (const item of batch) {
        const r = out.results.find((x) => x.ticker.toUpperCase() === item.ticker.toUpperCase());
        const weights = r ? sectorWeightsFromPercents(r.sectors) : null;
        if (weights) found[item.ticker.toUpperCase()] = weights;
        if (r) console.log(`[breakdown] ${item.ticker.toUpperCase()} -> ${weights ? weights.length + " sectors" : "rejected"} (${r.basis})`);
      }
    }
  } catch (e) {
    throw toAiError(e);
  }
  return { found, usage, searches };
}
