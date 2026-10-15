import { z } from "zod";
import { AiError, reviewHoldings } from "@/lib/ai/claude";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  rows: z
    .array(
      z.object({
        ticker: z.string(),
        name: z.string(),
        assetClass: z.string(),
        sector: z.string().nullable(),
        shares: z.number(),
        costBasisPerShare: z.number(),
        currentPrice: z.number(),
      }),
    )
    .min(1)
    .max(500),
});

/** "Double-check with Claude": sends the already-parsed rows (text only, no file) for a sanity review. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("bad_file", "There are no valid rows to check.");
    const { review, usage } = await reviewHoldings(body.data.rows);
    console.log(`[import] Claude reviewed ${body.data.rows.length} rows: ${review.flags.length} flags, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
    return Response.json({ ok: true, ...review, usage });
  } catch (e) {
    return errorResponse(e);
  }
}
