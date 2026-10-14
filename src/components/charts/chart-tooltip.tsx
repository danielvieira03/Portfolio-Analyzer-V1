/** Shared hover-tooltip shell so every chart's tooltip looks the same. */
export function ChartTooltipBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-40 rounded-md border bg-popover px-2.5 py-2 text-[12px] shadow-lg">
      <p className="label-caps mb-1.5 text-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function ChartTooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color && <span className="size-2 rounded-[2px]" style={{ background: color }} />}
        {label}
      </span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}
