import type { HoldingClass } from "@/lib/portfolio/types";

/** The Income tab's low and high are the expected income minus and plus this share (fixed, not a forecast). */
export const INCOME_RANGE = 0.1;
/** How many income-producing holdings of each category get their own ribbon in the Sankey (the rest are grouped as "Other"). */
export const INCOME_TOP_FLOW = 3;
/** How many holdings each section lists before "Show all". */
export const INCOME_TOP_LIST = 5;
/** The three income categories, in the order they are shown. Cash interest is not included. */
export const INCOME_CATEGORIES: readonly HoldingClass[] = ["Equities", "Fixed Income", "Alternatives"];
