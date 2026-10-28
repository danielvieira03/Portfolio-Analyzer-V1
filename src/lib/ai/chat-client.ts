// Browser-side helpers for the Ask AI chat: send a question and read the streamed answer, and remember how many
// questions this browser asked in the last hour (so the friendly limit message shows at once; the server also checks).

import { CHAT_LIMITS } from "@/config/ai";
import type { ChatMessage } from "./chat";
import { parseChatStream, type ChatSource, type ParsedStream } from "./stream-mark";

/** One message on the screen: what is sent to the server is only `role` and `content`; the rest is shown with an answer. */
export interface ChatTurn extends ChatMessage {
  /** Claude is searching the web right now. */
  searching?: boolean;
  /** The answer used web search. */
  usedWeb?: boolean;
  /** Web search was paused for this visitor, so the answer uses the portfolio data only. */
  webPaused?: boolean;
  sources?: ChatSource[];
}

const turnFrom = (p: ParsedStream): ChatTurn => ({ role: "assistant", content: p.text, searching: p.searching, usedWeb: p.usedWeb, webPaused: p.webPaused, sources: p.sources });

/** Sends the latest messages with the snapshot and calls `onUpdate` with the whole answer so far, as it arrives. Returns the finished answer. */
export async function streamChat(messages: ChatMessage[], snapshot: string, onUpdate: (answerSoFar: ChatTurn) => void, signal?: AbortSignal): Promise<ChatTurn> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-CHAT_LIMITS.historyMessages).map(({ role, content }) => ({ role, content })), snapshot }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error("Couldn’t reach the app. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Something went wrong. Please try again.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    const parsed = parseChatStream(raw);
    if (parsed.error !== null) throw new Error(parsed.error);
    onUpdate(turnFrom(parsed));
  }
  const parsed = parseChatStream(raw);
  if (!parsed.text) throw new Error("Claude didn’t send an answer. Please try again.");
  return { ...turnFrom(parsed), searching: false };
}

const KEY = "portfolio-analyzer:ask-ai:asked";

/** When this browser asked its questions (ms timestamps). Empty if storage is unavailable. */
export function loadAsked(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((t): t is number => typeof t === "number") : [];
  } catch {
    return [];
  }
}

export function saveAsked(stamps: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamps));
  } catch {
    /* private window or blocked storage: the server still enforces the limit */
  }
}
