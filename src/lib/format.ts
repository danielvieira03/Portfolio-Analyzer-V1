// One place for number formatting so every table, card and chart agrees.

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const currencyCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** $1,234 (whole dollars) — totals and market values. */
export const formatCurrency = (v: number) => currency.format(v);

/** $1,234.56 — per-share prices and cost bases. */
export const formatPrice = (v: number) => currencyCents.format(v);

/** +$1,234 / -$1,234 — gains and losses always show their sign. */
export const formatSignedCurrency = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "-" : ""}${currency.format(Math.abs(v))}`;

/** 12.34% — weights and allocations (input is a fraction: 0.1234). */
export const formatPercent = (fraction: number, digits = 2) =>
  `${(fraction * 100).toFixed(digits)}%`;

/** +12.34% / -1.20% — returns always show their sign. */
export const formatSignedPercent = (fraction: number, digits = 2) =>
  `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(digits)}%`;

/** 1,234.5 — share counts. */
export const formatShares = (v: number) => number.format(v);

/** Oct 13, 2026 */
export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));

/** "3:42 PM" for today, "Oct 17, 3:42 PM" for an earlier day. Uses the viewer's time zone unless one is given. */
export function formatUpdated(d: Date | string, now: Date = new Date(), timeZone?: string): string {
  const date = new Date(d);
  const day = (x: Date) => x.toLocaleDateString("en-US", { timeZone });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  if (day(date) === day(now)) return time;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone })}, ${time}`;
}
