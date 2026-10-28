import { Fragment } from "react";

/** **bold** inside a line. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    const kind = bullet ? "ul" : numbered ? "ol" : "p";
    const content = (bullet ?? numbered)?.[1] ?? line.replace(/^#{1,4}\s+/, "");
    const last = out[out.length - 1];
    if (kind !== "p" && last && last.kind === kind) last.items.push(content);
    else if (kind === "p") out.push({ kind: "p", text: raw.trim().startsWith("#") ? `**${content}**` : content });
    else out.push({ kind, items: [content] });
  }
  return out;
}

/** An answer from Claude shown as simple formatted text: paragraphs, bullet and numbered lists, and bold. */
export function AnswerText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {blocks(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{inline(b.text)}</p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-primary">
            {b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-primary">
            {b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}
          </ol>
        ),
      )}
    </div>
  );
}
