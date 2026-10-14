"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <p className="label-caps px-2 pb-1.5 pt-1">Analyze</p>
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              active && "border-primary bg-sidebar-accent text-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
