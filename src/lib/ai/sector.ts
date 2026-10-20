// Looks up the sector of equity holdings the market data provider had no sector for (import preview only).
// SERVER ONLY (uses the API key through ./claude).

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AI_MODEL } from "@/config/ai";
import { checkSector } from "@/lib/import/enrich";
import { SECTORS } from "@/lib/portfolio/sectors";
import { AiError, getClient, toAiError, type AiUsage } from "./claude";

export interface SectorItem {
  ticker: string;
  name: string;
}

const resultSchema = z.object({
  results: z.array(
    z.object({
      ticker: z.string(),
      sector: z.string().describe("Exactly one of the allowed sectors, or Diversified"),
      basis: z.string().describe("One short phrase: what you found or knew"),
    }),
  ),
});

const SYSTEM = `You label equity holdings for a portfolio tracker with ONE sector each.

For an individual company use its GICS sector, exactly one of: ${SECTORS.join(", ")}.
For a broad equity fund or ETF that spreads across many sectors (an S&P 500, total market, world or international index fund, ...) answer "Diversified". A fund that holds a single sector (e.g. a technology ETF) gets that sector.

If you are not sure what a ticker is, run a web search first (issuer page, factsheet or a fund / company data site). Never invent: if you cannot tell, leave that holding OUT of the results (it will be filled in by hand). Use the exact ticker you were given.`;

const BATCH_SIZE = 10;
const MAX_PAUSES = 3;

async function lookupBatch(items: SectorItem[]): Promise<{ results: z.infer<typeof resultSchema>["results"]; usage: AiUsage; searches: number }> {
  const client = getClient();
  const messages: Parameters<typeof client.beta.messages.parse>[0]["messages"] = [
    { role: "user", content: `Give the sector of each holding (JSON):\n${JSON.stringify(items)}` },
  ];
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;

  for (let turn = 0; turn <= MAX_PAUSES; turn++) {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.max(2, items.length) }],
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

/** Sector (or "Diversified") per upper-case ticker. Holdings Claude gave no usable answer for are left out. */
export async function lookupSectors(items: SectorItem[]): Promise<{ found: Record<string, string>; usage: AiUsage; searches: number }> {
  const wanted = items.slice(0, 20);
  const found: Record<string, string> = {};
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
        const sector = r ? checkSector(r.sector) : null;
        if (sector) found[item.ticker.toUpperCase()] = sector;
      }
    }
  } catch (e) {
    throw toAiError(e);
  }
  return { found, usage, searches };
}
