"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Composer } from "@/components/ask/composer";
import { MessageBubble } from "@/components/ask/message-bubble";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { LoadingPage } from "@/components/shared/loading-page";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { CHAT_LIMITS } from "@/config/ai";
import type { ChatMessage } from "@/lib/ai/chat";
import { loadAsked, saveAsked, streamChat } from "@/lib/ai/chat-client";
import { checkLimit, limitMessage } from "@/lib/ai/rate-limit";
import { snapshotText } from "@/lib/ai/snapshot";

export function AskView() {
  const state = usePortfolio();
  // The conversation lives only in this page's memory: reloading or leaving the tab clears it.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages, error]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!state) return <LoadingPage title="Ask AI" subtitle="Ask about your portfolio" />;
  const { doc } = state;

  async function ask(question: string, history: ChatMessage[]) {
    const snapshot = snapshotText(doc);
    if (!snapshot) return;
    const check = checkLimit(loadAsked(), Date.now(), CHAT_LIMITS.questionsPerHour);
    setError(null);
    if (!check.allowed) {
      setError(limitMessage(CHAT_LIMITS.questionsPerHour));
      return;
    }
    const conversation: ChatMessage[] = [...history, { role: "user", content: question }];
    setMessages([...conversation, { role: "assistant", content: "" }]);
    setLastQuestion(question);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const answer = await streamChat(conversation, snapshot, (soFar) => setMessages([...conversation, { role: "assistant", content: soFar }]), controller.signal);
      saveAsked(check.stamps);
      setMessages([...conversation, { role: "assistant", content: answer }]);
    } catch (e) {
      if (controller.signal.aborted) return;
      setMessages(conversation); // the question stays; the half answer is dropped
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const clear = () => {
    abort.current?.abort();
    setMessages([]);
    setError(null);
    setBusy(false);
  };

  const header = (
    <PageHeader
      title="Ask AI"
      subtitle="Ask questions about your portfolio"
      actions={
        <>
          {doc.isDemoData && <DemoBadge />}
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clear}>
              <Trash2 /> Clear chat
            </Button>
          )}
        </>
      }
    />
  );

  if (doc.holdings.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <EmptyState title="Add your holdings first" description="Upload your positions, then you can ask questions about your portfolio here." />
      </div>
    );
  }

  const retryable = error !== null && lastQuestion !== "" && messages[messages.length - 1]?.role === "user";

  return (
    <div className="space-y-3">
      {header}
      <Panel title="Chat" className="mx-auto max-w-3xl [&>div]:p-0">
        <div className="max-h-[55vh] min-h-64 space-y-3 overflow-y-auto p-3" aria-live="polite">
          {messages.length === 0 && !error && (
            <p className="py-10 text-center text-muted-foreground">
              Pick an example question or type your own. Answers use only the numbers in your portfolio.
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} pending={busy && i === messages.length - 1} />
          ))}
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              <span>{error}</span>
              {retryable && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => ask(lastQuestion, messages.slice(0, -1))}>
                  Try again
                </Button>
              )}
            </div>
          )}
          <div ref={end} />
        </div>
        <Composer busy={busy} onSend={(q) => ask(q, messages.filter((m) => m.content).slice(-(CHAT_LIMITS.historyMessages - 1)))} />
      </Panel>
      <p className="mx-auto max-w-3xl text-center text-[11px] text-muted-foreground">
        Analysis based on your holdings and estimated data. Not personalized investment advice.
      </p>
    </div>
  );
}
