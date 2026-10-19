import { formatDate, formatPercent } from "@/lib/format";

/**
 * The small print under an exposure chart about fund data: how old it is and how many funds have none.
 * Empty when there is nothing to say (no funds were involved). `oldest` is an ISO date or null.
 */
export function fundDataNote(oldest: string | null, fundsWithoutData: number): string {
  const parts: string[] = [];
  if (oldest) parts.push(`Fund data as of ${formatDate(oldest)}.`);
  if (fundsWithoutData > 0) parts.push(`${fundsWithoutData} ${fundsWithoutData === 1 ? "fund has" : "funds have"} no breakdown data.`);
  return parts.join(" ");
}

/** "Unclassified: 8.3% of the holdings counted (no country)." Empty when nothing is unclassified. */
export function unclassifiedNote(weight: number, what: "sector" | "country"): string {
  if (!(weight > 0)) return "";
  return `Unclassified: ${formatPercent(weight, 1)} of the holdings counted has no ${what} data.`;
}
