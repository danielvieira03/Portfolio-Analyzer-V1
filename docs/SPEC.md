# Portfolio Analyzer — Spec (big picture)

## What it is
A single-user web app for analyzing an investment portfolio. Positions are entered by hand or imported
from CSV/Excel, stored in a local database, and shown in a dark, dense, terminal-style interface.
It is a rebuild of an earlier plain HTML/JS version, with the emphasis on quality, structure and visuals.

## What it has now
- **Dashboard** — total value, cost basis, unrealized gain/loss, cash and holding count; allocation by asset
  class; equity sector weights versus the S&P 500; top 5 holdings.
- **Holdings** — one sortable table per asset class (Equities, Fixed Income, Alternatives), a separate
  cash card, add/edit/remove (adding an existing ticker offers to average it in or replace it), and import
  with a preview.
- **Risk Analysis** — a Risk Profile meter (1 Conservative to 5 Aggressive) scored from the asset-class mix only:
  each class's share of the portfolio times its risk weight (Equities 5, Alternatives 3.5, Fixed Income 2, Cash 1,
  editable in `src/config/risk.ts`). Known limitation: it ignores how volatile the holdings inside a class are.
- **Import** (button on both Dashboard and Holdings) — CSV/Excel (parsed locally, tolerant of different column names, with manual column matching)
  and Screenshot/PDF (read by Claude). The first step of Import is choosing "Add additional holdings" or "New portfolio". The
  preview looks like the Holdings table; in Add mode repeated tickers are flagged, averaged by default, and can be
  unticked. CSV/Excel files get an automatic "Claude check" (parsed rows only, text, no file) that flags data mistakes only; it never blocks the import.
- A demo portfolio (~$500K) loaded on first run, clearly badged and removable.

## What it deliberately lacks
Live market prices (prices are entered manually), daily change figures, AI features beyond import,
historical performance, multiple portfolios, login, and deployment.

## Direction
Future tabs, each added as a new top-bar tab:
- **Portfolio Health** — diversification and concentration checks.
- **Crash Simulator** — estimated portfolio impact under historical or custom shocks.
- **Risk** — volatility, drawdown and exposure measures.
