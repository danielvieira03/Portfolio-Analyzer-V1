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
