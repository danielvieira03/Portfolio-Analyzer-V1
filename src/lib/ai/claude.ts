// Calls to the Claude API. SERVER ONLY: this reads ANTHROPIC_API_KEY, so it must only be
// imported from route handlers / server actions, never from a "use client" component.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, IMAGE_TYPES, PDF_TYPE } from "@/config/ai";
import { EXTRACT_SYSTEM, EXTRACT_USER, REVIEW_SYSTEM } from "./prompts";
import { extractionSchema, reviewSchema, type Extraction, type Review } from "./schema";

/** An error whose message is safe and useful to show to the user. */
export class AiError extends Error {
  constructor(
    public code: "no_key" | "auth" | "credit" | "rate_limit" | "connection" | "refused" | "too_long" | "bad_file" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError("no_key", "No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.local and restart the app.");
  }
  return new Anthropic({ apiKey });
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new AiError("auth", "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.local.");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limit", "Claude is receiving too many requests right now. Wait a minute and try again.");
  }
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(e.message)) {
      return new AiError("credit", "Your Anthropic account is out of credit. Add credit in the Anthropic console, then try again.");
    }
    return new AiError("bad_file", "Claude couldn’t process that file. Try a clearer, smaller screenshot or a different PDF.");
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new AiError("connection", "Couldn’t reach Claude. Check your internet connection and try again.");
  }
  console.error("Claude API error:", e);
  return new AiError("failed", "Something went wrong talking to Claude. Please try again.");
}

type ImageType = (typeof IMAGE_TYPES)[number];

/** Read a screenshot or PDF and return the holdings Claude found. */
export async function extractHoldings(
  bytes: Buffer,
  mediaType: string,
): Promise<{ extraction: Extraction; usage: AiUsage }> {
  const data = bytes.toString("base64");
  const fileBlock =
    mediaType === PDF_TYPE
      ? ({ type: "document", source: { type: "base64", media_type: PDF_TYPE, data } } as const)
      : (IMAGE_TYPES as readonly string[]).includes(mediaType)
        ? ({ type: "image", source: { type: "base64", media_type: mediaType as ImageType, data } } as const)
        : null;
  if (!fileBlock) throw new AiError("bad_file", "Please upload a PNG, JPEG, WebP or GIF screenshot, or a PDF.");

  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // if a safety check declines, the API retries on a fallback model
      system: EXTRACT_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(extractionSchema) },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: EXTRACT_USER }] }],
    });
    if (response.stop_reason === "refusal") {
      throw new AiError("refused", "Claude declined to read that file. Try a different screenshot or use a CSV/Excel export.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("too_long", "That document has too many holdings to read in one go. Try splitting it into smaller screenshots or pages.");
    }
    if (!response.parsed_output) throw new AiError("failed", "Claude’s answer couldn’t be understood. Please try again.");
    return {
      extraction: response.parsed_output,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (e) {
    throw toAiError(e);
  }
}

export interface ReviewRow {
  ticker: string;
  name: string;
  assetClass: string;
  sector: string | null;
  shares: number;
  costBasisPerShare: number;
  currentPrice: number;
}

/** Text-only sanity check of already-parsed rows. No file is sent. */
export async function reviewHoldings(rows: ReviewRow[]): Promise<{ review: Review; usage: AiUsage }> {
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: REVIEW_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(reviewSchema) },
      messages: [
        {
          role: "user",
          content: `Here are the holdings about to be imported (JSON):\n${JSON.stringify(rows)}\n\nFlag anything that looks wrong.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new AiError("refused", "Claude declined to review this data.");
    if (!response.parsed_output) throw new AiError("failed", "Claude’s answer couldn’t be understood. Please try again.");
    return {
      review: response.parsed_output,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (e) {
    throw toAiError(e);
  }
}
