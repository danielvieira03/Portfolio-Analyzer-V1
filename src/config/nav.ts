import { Coins, LayoutDashboard, ShieldAlert, Sparkles, Table2, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Add future tabs here — the top-bar tabs render whatever is in this list.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Holdings", href: "/holdings", icon: Table2 },
  { label: "Risk Analysis", href: "/risk", icon: ShieldAlert },
  { label: "Income", href: "/income", icon: Coins },
  { label: "Ask AI", href: "/ask", icon: Sparkles },
];

export const APP_NAME = "Portfolio Analyzer";
