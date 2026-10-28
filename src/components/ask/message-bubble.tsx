import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";

/** One chat bubble: the visitor's question on the right (amber-tinted), Claude's answer on the left. `pending` shows loading dots. */
export function MessageBubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
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
        ) : pending && !content ? (
          <span className="flex items-center gap-1 py-1" role="status" aria-label="Claude is thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </span>
        ) : (
          <AnswerText text={content} />
        )}
      </div>
    </div>
  );
}
