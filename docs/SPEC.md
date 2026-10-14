# Portfolio Analyzer — Spec (big picture)

## What it is
A single-user web app for analyzing an investment portfolio. Positions are entered by hand or imported
from CSV/Excel, stored in a local database, and shown in a dark, dense, terminal-style interface.
It is a rebuild of an earlier plain HTML/JS version, with the emphasis on quality, structure and visuals.

## What it has now
- **Dashboard** — total value, cost basis, unrealized gain/loss, cash and holding count; allocation by asset
  class; equity sector weights versus the S&P 500; top 5 holdings.
- **Holdings** — one sortable table per asset class (Equities, Fixed Income, Alternatives), a separate
  cash card, add/edit/remove, and CSV/Excel import with a preview.
- A demo portfolio (~$500K) loaded on first run, clearly badged and removable.

## What it deliberately lacks
Live market prices (prices are entered manually), daily change figures, AI/Claude features, historical
performance, multiple portfolios, login, and deployment.

## Direction
Future tabs, each added as a new sidebar item:
- **Portfolio Health** — diversification and concentration checks.
- **Crash Simulator** — estimated portfolio impact under historical or custom shocks.
- **Risk** — volatility, drawdown and exposure measures.
- **AI-assisted import** — Screenshot and PDF import (shown as "Coming soon" in the import dialog).
