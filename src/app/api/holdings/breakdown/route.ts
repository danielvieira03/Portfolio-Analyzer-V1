import { z } from "zod";
import { AiError } from "@/lib/ai/claude";
import { lookupBreakdowns } from "@/lib/ai/breakdown";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  items: z
    .array(z.object({ ticker: z.string().min(1).max(12), name: z.string().min(1).max(100) }))
    .min(1)
    .max(10),
});

/**
 * Reads the sector weights of equity ETFs with Claude (web search), for funds the market data has nothing for.
 * Nothing is stored here; the browser checks and saves the answer.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("bad_file", "There are no valid funds to look up.");
    const { found, usage, searches } = await lookupBreakdowns(body.data.items);
    console.log(`[breakdown] ${Object.keys(found).length}/${body.data.items.length} found, ${searches} searches, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
    return Response.json({ ok: true, found, usage, searches });
  } catch (e) {
    return errorResponse(e);
  }
}
