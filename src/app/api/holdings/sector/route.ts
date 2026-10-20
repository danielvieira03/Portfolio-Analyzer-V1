import { z } from "zod";
import { AiError } from "@/lib/ai/claude";
import { lookupSectors } from "@/lib/ai/sector";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  items: z
    .array(z.object({ ticker: z.string().min(1).max(12), name: z.string().min(1).max(100) }))
    .min(1)
    .max(20),
});

/**
 * Looks up the sector of equity holdings with Claude, for the import preview, after the market data provider had
 * nothing for them. Nothing is stored here; the browser keeps the answers until the visitor imports.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("bad_file", "There are no valid holdings to look up.");
    const { found, usage, searches } = await lookupSectors(body.data.items);
    console.log(`[sector] ${Object.keys(found).length}/${body.data.items.length} found, ${searches} searches, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
    return Response.json({ ok: true, found, usage, searches });
  } catch (e) {
    return errorResponse(e);
  }
}
