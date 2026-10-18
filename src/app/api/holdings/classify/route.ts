import { z } from "zod";
import { AiError } from "@/lib/ai/claude";
import { lookupSubtypes } from "@/lib/ai/classify";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        ticker: z.string().min(1).max(12),
        name: z.string().min(1).max(100),
        assetClass: z.enum(["Fixed Income", "Alternatives"]),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * Looks up the maturity (bonds) or type (alternatives) of funds with Claude + web search. The visitor's browser
 * only sends funds its own fund library doesn't know, and saves the answers itself; nothing is stored here.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("bad_file", "There are no valid holdings to look up.");
    const { found, durations, usage, searches } = await lookupSubtypes(body.data.items);
    console.log(`[classify] ${Object.keys(found).length}/${body.data.items.length} found, ${searches} searches, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
    return Response.json({ ok: true, found, durations, usage, searches });
  } catch (e) {
    return errorResponse(e);
  }
}
