import { cn } from "@/lib/utils";

/** Standard bordered panel with a small-caps title and optional right-hand slot. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <h2 className="label-caps">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}
