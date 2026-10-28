// Browser-side helpers for the Ask AI chat: send a question and read the streamed answer, and remember how many
// questions this browser asked in the last hour (so the friendly limit message shows at once; the server also checks).

import { CHAT_LIMITS } from "@/config/ai";
import type { ChatMessage } from "./chat";
import { STREAM_ERROR_MARK } from "./stream-mark";

/** Sends the latest messages with the snapshot and calls `onText` with the whole answer so far, as it arrives. */
export async function streamChat(messages: ChatMessage[], snapshot: string, onText: (answerSoFar: string) => void, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-CHAT_LIMITS.historyMessages), snapshot }),
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
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    const cut = text.indexOf(STREAM_ERROR_MARK);
    if (cut === -1) onText(text);
    else throw new Error(text.slice(cut + STREAM_ERROR_MARK.length) || "Something went wrong. Please try again.");
  }
  if (!text.trim()) throw new Error("Claude didn’t send an answer. Please try again.");
  return text;
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
