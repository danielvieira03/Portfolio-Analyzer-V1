// The Ask AI chat call. SERVER ONLY (uses the API key through getClient).

import type Anthropic from "@anthropic-ai/sdk";
import { CHAT_LIMITS, CHAT_MODEL, CHAT_PRICES, WEB_COST_CAP_USD } from "@/config/ai";
import { getClient, toAiError } from "./claude";
import { addUsage, estimateCost, noUsage, type ChatUsage } from "./cost";
import { CHAT_SYSTEM, CHAT_WEB_OFF, CHAT_WEB_ON, chatDataBlock } from "./prompts";
import { NOWEB_MARK, SEARCH_MARK, SOURCES_MARK, STREAM_ERROR_MARK, type ChatSource } from "./stream-mark";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A long turn with searches can be paused by the search tool; we continue it at most this many times. */
const MAX_CONTINUES = 2;

export interface ChatOptions {
  /** May this question search the web? (false once the visitor's hourly web limit is used up.) */
  allowWeb: boolean;
  /** Called once if the question really ran a web search (so the route can count it). */
  onWebSearch?: () => void;
  signal?: AbortSignal;
}

/**
 * Asks Claude and returns the reply as a stream of plain text (see stream-mark.ts for the few markers mixed in). The rules and
 * the portfolio data are sent as system blocks; the data block is marked for prompt caching so repeated questions about the same
 * portfolio re-read it cheaply. When `allowWeb` is set Claude may search the web for outside information (at most
 * `CHAT_LIMITS.webSearchMaxUses` times, and the estimated cost is kept under `WEB_COST_CAP_USD`). A failure after the stream
 * has started is written into the stream after STREAM_ERROR_MARK.
 */
export function streamChatReply(messages: ChatMessage[], snapshotJson: string, opts: ChatOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const client = getClient(); // throws AiError("no_key") before any streaming starts
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const timer = new AbortController();
      const timeout = setTimeout(() => timer.abort(), CHAT_LIMITS.timeoutMs);
      opts.signal?.addEventListener("abort", () => timer.abort());
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const sources = new Map<string, ChatSource>();
      let usage: ChatUsage = noUsage();
      let told = false;
      try {
        if (!opts.allowWeb) send(NOWEB_MARK);
        const convo: Anthropic.MessageParam[] = [...messages];
        for (let turn = 0; turn <= MAX_CONTINUES; turn++) {
          const stream = client.messages.stream(
            {
              model: CHAT_MODEL,
              max_tokens: CHAT_LIMITS.maxReplyTokens,
              // No thinking before the answer: with a reply cap this small it could use up all of it before any text. This is the
              // "off" setting this model accepts ("disabled" is refused); if CHAT_MODEL is changed to a model that wants "disabled", change it here.
              thinking: { type: "between_tools" },
              system: [
                { type: "text", text: CHAT_SYSTEM + (opts.allowWeb ? CHAT_WEB_ON : CHAT_WEB_OFF) },
                { type: "text", text: chatDataBlock(snapshotJson), cache_control: { type: "ephemeral" } },
              ],
              // Plain web search (not the newer code-filtering one): its cost is predictable.
              ...(opts.allowWeb ? { tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: CHAT_LIMITS.webSearchMaxUses }] } : {}),
              messages: convo,
            },
            { signal: timer.signal },
          );
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(event.delta.text);
            else if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
              send(SEARCH_MARK);
              if (!told) {
                told = true;
                opts.onWebSearch?.();
              }
            } else if (event.type === "content_block_delta" && event.delta.type === "citations_delta") {
              const c = event.delta.citation;
              if (c.type === "web_search_result_location" && /^https?:\/\//.test(c.url) && !sources.has(c.url)) sources.set(c.url, { title: c.title ?? c.url, url: c.url });
            }
          }
          const final = await stream.finalMessage();
          usage = addUsage(usage, {
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
            cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
            searches: final.usage.server_tool_use?.web_search_requests ?? 0,
          });
          // A paused turn is continued, unless that could pass the cost cap (then we stop and keep what was written).
          if (final.stop_reason !== "pause_turn" || estimateCost(usage, CHAT_PRICES) >= WEB_COST_CAP_USD) {
            console.log(`[chat] ${usage.inputTokens} in (+${usage.cacheWriteTokens} cache write, ${usage.cacheReadTokens} cache read) / ${usage.outputTokens} out tokens, ${usage.searches} searches, about $${estimateCost(usage, CHAT_PRICES).toFixed(3)}, stopped: ${final.stop_reason}`);
            break;
          }
          convo.push({ role: "assistant", content: final.content as Anthropic.ContentBlockParam[] });
        }
        if (sources.size > 0) send(SOURCES_MARK + JSON.stringify([...sources.values()].slice(0, 6)));
      } catch (e) {
        const message = timer.signal.aborted && !opts.signal?.aborted ? "Claude took too long to answer. Please try again." : toAiError(e).message;
        send(STREAM_ERROR_MARK + message);
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  });
}
