import { cn } from "@/lib/utils";

type Tone = "neutral" | "auto";

/**
 * A number in the app's standard style: monospace, tabular, right-aligned.
 * tone="auto" colours it green/red by sign — use ONLY for gains and losses.
 */
export function Num({
  children,
  value,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  value?: number;
  tone?: Tone;
  className?: string;
}) {
  const color =
    tone === "auto" && value !== undefined && value !== 0
      ? value > 0
        ? "text-gain"
        : "text-loss"
      : undefined;
  return <span className={cn("num", color, className)}>{children}</span>;
}
