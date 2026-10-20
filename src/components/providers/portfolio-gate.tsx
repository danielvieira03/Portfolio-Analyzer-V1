"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePortfolio } from "./use-portfolio";

/**
 * A visitor with no portfolio in this browser yet (first visit) is sent to the home page to pick a demo or start
 * their own. The home page itself is always open. Visitors with a saved portfolio are never affected.
 */
export function PortfolioGate({ children }: { children: React.ReactNode }) {
  const state = usePortfolio();
  const pathname = usePathname();
  const router = useRouter();
  const redirecting = state !== null && !state.chosen && pathname !== "/";

  useEffect(() => {
    if (redirecting) router.replace("/");
  }, [redirecting, router]);

  return redirecting ? null : <>{children}</>;
}
