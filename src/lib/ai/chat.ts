// The Ask AI chat call. SERVER ONLY (uses the API key through getClient).

import { CHAT_LIMITS, CHAT_MODEL } from "@/config/ai";
import { getClient, toAiError } from "./claude";
import { CHAT_SYSTEM, chatDataBlock } from "./prompts";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** What follows the text in the stream when something goes wrong half way (the browser shows it as an error). */
export const STREAM_ERROR_MARK = "\u001eERROR:";

/**
 * Asks Claude and returns the reply as a stream of plain text. The rules and the portfolio data are sent as system
 * blocks; the data block is marked for prompt caching so repeated questions about the same portfolio re-read it cheaply
 * (caching only starts once the block is long enough, otherwise it is simply ignored). A failure after the stream
 * has started is written into the stream after STREAM_ERROR_MARK.
 */
export function streamChatReply(messages: ChatMessage[], snapshotJson: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const client = getClient(); // throws AiError("no_key") before any streaming starts
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const timer = new AbortController();
      const timeout = setTimeout(() => timer.abort(), CHAT_LIMITS.timeoutMs);
      signal?.addEventListener("abort", () => timer.abort());
      try {
        const stream = client.messages.stream(
          {
            model: CHAT_MODEL,
            max_tokens: CHAT_LIMITS.maxReplyTokens,
            system: [
              { type: "text", text: CHAT_SYSTEM },
              { type: "text", text: chatDataBlock(snapshotJson), cache_control: { type: "ephemeral" } },
            ],
            messages,
          },
          { signal: timer.signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        console.log(`[chat] ${final.usage.input_tokens} in (+${final.usage.cache_creation_input_tokens ?? 0} cache write, ${final.usage.cache_read_input_tokens ?? 0} cache read) / ${final.usage.output_tokens} out tokens`);
      } catch (e) {
        const message = timer.signal.aborted && !signal?.aborted ? "Claude took too long to answer. Please try again." : toAiError(e).message;
        controller.enqueue(encoder.encode(STREAM_ERROR_MARK + message));
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  });
}
