"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CHAT_LIMITS, EXAMPLE_QUESTIONS } from "@/config/ai";

/** The example questions, the text box and the send button. Enter sends; Shift+Enter starts a new line. */
export function Composer({ busy, onSend }: { busy: boolean; onSend: (question: string) => void }) {
  const [text, setText] = useState("");
  const max = CHAT_LIMITS.maxQuestionChars;
  const ready = text.trim().length > 0 && text.length <= max && !busy;

  const send = () => {
    if (!ready) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="space-y-2 border-t p-3">
      <div className="flex flex-wrap gap-1.5" aria-label="Example questions">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy}
            onClick={() => onSend(q)}
            className="rounded-full border bg-background px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Ask about your portfolio…"
            aria-label="Your question"
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-primary"
          />
          <p className={text.length > max ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
            {text.length}/{max}
          </p>
        </div>
        <Button onClick={send} disabled={!ready} size="lg" className="mb-5" aria-label="Send question">
          <Send className="size-4" /> Send
        </Button>
      </div>
    </div>
  );
}
