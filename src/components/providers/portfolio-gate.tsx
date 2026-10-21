"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePortfolio } from "./use-portfolio";

/** Pages open to everyone, including a first-time visitor: the home page and the two pages it leads to. */
export const OPEN_PATHS = ["/", "/demos", "/upload"];

/**
 * A visitor with no portfolio in this browser yet (first visit) is sent to the home page to pick a demo or start
 * their own. The home page and its two pages (demos, upload) are always open. Visitors with a saved portfolio are never affected.
 */
export function PortfolioGate({ children }: { children: React.ReactNode }) {
  const state = usePortfolio();
  const pathname = usePathname();
  const router = useRouter();
  const redirecting = state !== null && !state.chosen && !OPEN_PATHS.includes(pathname);

  useEffect(() => {
    if (redirecting) router.replace("/");
  }, [redirecting, router]);

  return redirecting ? null : <>{children}</>;
}
