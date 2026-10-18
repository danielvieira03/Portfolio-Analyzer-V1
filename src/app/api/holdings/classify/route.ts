import { z } from "zod";
import { AiError } from "@/lib/ai/claude";
import { getFunds, saveFunds } from "@/data/funds.repo";
import { lookupSubtypes } from "@/lib/ai/classify";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";
import { resolveSubtypes } from "@/lib/funds/resolve";

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
 * Finds the maturity (bonds) or type (alternatives) of holdings. The fund library answers what it knows (free);
 * only unknown funds go to Claude + web search, and what Claude finds is saved to the library.
 * Nothing on the holdings themselves is saved here.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("bad_file", "There are no valid holdings to look up.");
    const { found, fromLibrary, searched, usage, searches } = await resolveSubtypes(body.data.items, {
      getLibrary: getFunds,
      lookup: lookupSubtypes,
      save: saveFunds,
    });
    console.log(`[classify] ${Object.keys(found).length}/${body.data.items.length} found: ${fromLibrary} from the library, ${searched} sent to Claude (${searches} searches, ${usage.inputTokens} in / ${usage.outputTokens} out tokens)`);
    return Response.json({ ok: true, found, fromLibrary, searched, usage, searches });
  } catch (e) {
    return errorResponse(e);
  }
}
