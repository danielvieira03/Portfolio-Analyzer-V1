"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

/** Horizontal tab buttons. Scrolls sideways on narrow screens if tabs ever overflow. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="-mb-px flex h-full items-stretch gap-1 overflow-x-auto [scrollbar-width:none]"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
              active && "border-primary bg-accent/40 text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
