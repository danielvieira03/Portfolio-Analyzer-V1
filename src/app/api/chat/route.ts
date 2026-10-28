import { z } from "zod";
import { CHAT_LIMITS } from "@/config/ai";
import { streamChatReply } from "@/lib/ai/chat";
import { AiError } from "@/lib/ai/claude";
import { checkLimit, limitMessage } from "@/lib/ai/rate-limit";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 90;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(CHAT_LIMITS.maxQuestionChars * 12) }))
    .min(1)
    .max(CHAT_LIMITS.historyMessages),
  snapshot: z.string().max(CHAT_LIMITS.maxSnapshotChars),
});

// Questions asked per visitor (by IP) in the last hour. In memory only: it resets when the server restarts and each
// server copy keeps its own, so it stops casual overuse, not a determined abuser (the app has no database).
const asked = new Map<string, number[]>();
// Same, for the questions that really searched the web (a stricter limit: a search costs far more than a plain answer).
const askedWeb = new Map<string, number[]>();

function visitorId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Answers a question about the visitor's portfolio. The browser sends the last few chat messages and the portfolio
 * snapshot (numbers the app already calculated); nothing is stored here, and the key never leaves the server.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new AiError("failed", "That question couldn’t be read. Please try again.");
    const messages = body.data.messages.slice(-CHAT_LIMITS.historyMessages);
    while (messages.length > 0 && messages[0].role !== "user") messages.shift(); // the conversation must start with a question
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") throw new AiError("failed", "That question couldn’t be read. Please try again.");
    if (last.content.length > CHAT_LIMITS.maxQuestionChars) throw new AiError("too_long", `Please keep your question under ${CHAT_LIMITS.maxQuestionChars} characters.`);
    if (!body.data.snapshot.trim()) throw new AiError("empty_portfolio", "Add some holdings first, then ask about your portfolio.");

    const id = visitorId(req);
    const check = checkLimit(asked.get(id) ?? [], Date.now(), CHAT_LIMITS.questionsPerHour);
    if (!check.allowed) throw new AiError("limit", limitMessage(CHAT_LIMITS.questionsPerHour));
    asked.set(id, check.stamps);
    if (asked.size > 5000) for (const [k, v] of asked) if (Date.now() - Math.max(...v) > 3_600_000) asked.delete(k);

    // Web search is allowed while the visitor has web questions left this hour; a question is only counted if it really searched.
    const web = checkLimit(askedWeb.get(id) ?? [], Date.now(), CHAT_LIMITS.webQuestionsPerHour);
    const stream = streamChatReply(messages, body.data.snapshot, {
      allowWeb: web.allowed,
      onWebSearch: () => askedWeb.set(id, [...(askedWeb.get(id) ?? []).filter((t) => t > Date.now() - 3_600_000), Date.now()]),
      signal: req.signal,
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
