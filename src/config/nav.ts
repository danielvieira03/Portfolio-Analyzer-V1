import { LayoutDashboard, ShieldAlert, Table2, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Add future tabs here — the top-bar tabs render whatever is in this list.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Holdings", href: "/holdings", icon: Table2 },
  { label: "Risk Analysis", href: "/risk", icon: ShieldAlert },
];

export const APP_NAME = "Portfolio Analyzer";
