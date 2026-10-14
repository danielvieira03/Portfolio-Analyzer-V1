import { LayoutDashboard, Table2, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Add future tabs here — the sidebar renders whatever is in this list.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Holdings", href: "/holdings", icon: Table2 },
];

export const APP_NAME = "Portfolio Analyzer";
