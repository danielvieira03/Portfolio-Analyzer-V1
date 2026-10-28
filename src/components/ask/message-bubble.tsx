import { Globe } from "lucide-react";
import type { ChatTurn } from "@/lib/ai/chat-client";
import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";

/** One chat bubble: the visitor's question on the right (amber-tinted), Claude's answer on the left. `pending` shows loading dots; a web search shows its own status and, afterwards, its sources. */
export function MessageBubble({ turn, pending }: { turn: ChatTurn; pending?: boolean }) {
  const { role, content, searching, usedWeb, webPaused, sources = [] } = turn;
  const mine = role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-lg border px-3 py-2 text-[13px] leading-relaxed sm:max-w-[80%]",
          mine ? "border-primary/40 bg-primary/10 text-foreground" : "bg-panel-raised text-muted-foreground",
        )}
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : pending && !content && !searching ? (
          <span className="flex items-center gap-1 py-1" role="status" aria-label="Claude is thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </span>
        ) : (
          <>
            {content && <AnswerText text={content} />}
            {searching && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-primary" role="status">
                <Globe className="size-3.5 animate-pulse" /> Searching the web…
              </p>
            )}
            {!searching && usedWeb && (
              <div className="mt-3 border-t pt-2 text-[11px]">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="size-3" /> Used web search
                </p>
                {sources.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {sources.map((s) => (
                      <li key={s.url} className="truncate">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!pending && webPaused && <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">Web search is paused for this hour (limit reached), so this answer uses your portfolio data only.</p>}
          </>
        )}
      </div>
    </div>
  );
}
