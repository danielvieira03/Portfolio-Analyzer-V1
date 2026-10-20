"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/config/nav";
import { NavLinks } from "./nav-links";

/** Two rows: the app name on top (a link home), navigation tabs underneath. The home page shows the name only. */
export function TopBar() {
  const onHome = usePathname() === "/";
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b bg-sidebar px-4 md:px-6">
      <div className="flex h-12 items-center">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME}, home`}>
          <span className="size-2.5 rounded-[2px] bg-primary" aria-hidden />
          <span className="text-base font-semibold uppercase tracking-[0.16em]">{APP_NAME}</span>
        </Link>
      </div>
      {!onHome && (
        <div className="h-9">
          <NavLinks />
        </div>
      )}
    </header>
  );
}
