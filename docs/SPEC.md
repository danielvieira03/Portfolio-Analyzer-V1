# Portfolio Analyzer — Spec (big picture)

Current release: **v1.0** (live on Vercel).

## What it is
A web app for analyzing an investment portfolio. Positions are entered by hand or imported
from CSV/Excel, saved **in the visitor's own browser** (no accounts, no server database: each person who opens the
app has their own private portfolio), and shown in a dark, dense, terminal-style interface. The server only holds the
API keys and does market data and Claude lookups for the browser.
It is a rebuild of an earlier plain HTML/JS version, with the emphasis on quality, structure and visuals.

## What it has now
- **Dashboard** — total value, cost basis, unrealized gain/loss and cash; allocation by asset
  class and by equity sector (top 7 sectors, broad funds as "Diversified", the rest grouped as "Other" with a hover
  card listing them), by fixed-income maturity and by alternatives type; top 5 holdings.
- **Holdings** — one sortable table per asset class (Equities, Fixed Income, Alternatives), a separate
  cash card, add/edit/remove (adding an existing ticker offers to average it in or replace it), and import
  with a preview.
- **Risk Analysis** — equity sector weights versus the S&P 500 (with a plain-English over/underweight summary beside it), plus a Risk Profile meter (1 Conservative to 5 Aggressive) scored from the asset-class mix only:
  each class's share of the portfolio times its risk weight (Equities 5, Alternatives 3.5, Fixed Income 2, Cash 1,
  editable in `src/config/risk.ts`). Known limitation: it ignores how volatile the holdings inside a class are.
- **Maturity and Type** — Fixed Income holdings have a Maturity (short / medium / long-term / not specified) and
  Alternatives a Type (commodities, REITs, crypto, infrastructure, other), as sortable columns and form fields.
  Missing values are filled automatically in the import preview, or with the "Look up with Claude" button on the
  Holdings page. A **fund library** answers first, for free: it starts with 20 well-known bond funds
  and 20 alternatives funds (`src/config/fund-library.ts`; bond figures read from iShares and Vanguard pages, including
  each fund's duration in years, saved but not shown yet). Only funds the library doesn't know are searched by Claude
  (about 3 to 5 cents per fund), and what Claude finds is saved to the library **in that visitor's browser** (the built-in
  list ships with the app; nothing is shared between visitors) so that fund is not searched again for them
  (a bond fund Claude can't pin down is not saved). Values you set yourself are never overwritten. The allowed values
  live in `src/config/subtypes.ts`.
- **Market prices** — every holding's price comes from Financial Modeling Prep (profile lookup, one call per holding; the browser sends its own tickers and saves the answers, the server stores nothing):
  refreshed automatically every 2 minutes while the app is open (`PRICE_REFRESH_MINUTES` in `src/config/market.ts`), and on
  demand with the **Refresh** button on the Holdings tab, which also shows when prices were last updated. A ticker with no
  price available keeps the price you entered and shows a quiet "manual" tag. In the Add/Edit form, typing a ticker (as soon as the typing pauses for a moment, no need to leave the field)
  fills the name and price (and, in the Equities form, the sector: the stock's own sector, or "Diversified" for an ETF; bonds and alternatives get none), plus the Maturity / Type in the Fixed Income / Alternatives forms when the fund library knows the fund (free; unknown funds stay empty for the Look up button). The provider's sector names
  are translated to the app's S&P 500 style names in `src/config/market.ts`. The Starter plan allows 300 calls a minute (the free plan only about 250 a day, which a
  2-minute refresh would use up quickly); if a limit is hit, the refresh stops quietly, old prices stay, and the Holdings tab says
  "Limit hit. Try again in a few seconds."
- **Import** (button on both Dashboard and Holdings) — CSV/Excel (parsed locally, tolerant of different column names, with manual column matching)
  and Screenshot/PDF (read by Claude). The first step of Import is choosing "Add additional holdings" or "New portfolio". The
  preview looks like the Holdings table; in Add mode repeated tickers are flagged, averaged by default, and can be
  unticked. CSV/Excel files get an automatic "Claude check" (parsed rows only, text, no file) that flags data mistakes only; it never blocks the import.
- **Backup** (button on Holdings) — because the portfolio lives in one browser, you can download it as a file and restore it
  later, or move it to another browser or device. Restoring replaces the current portfolio after a confirm step.
- A demo portfolio (~$500K) shown to every new visitor, clearly badged and removable.

## Hosting and data
- **Hosting:** Vercel, connected to the GitHub repository. Every push to `main` builds and deploys the live site automatically;
  a failed build leaves the previous version live. API keys (`ANTHROPIC_API_KEY`, `FINANCIAL_MODELING_API_KEY`) are Vercel
  environment variables, never in the repo and never sent to the browser.
- **Data:** each visitor's portfolio (holdings, cash, prices, learned funds) is saved in their own browser's `localStorage` in a
  versioned format. The server has no database and stores nothing about any portfolio; its actions and routes are stateless lookups.
  A change to the saved format needs an upgrade step for existing visitors (see `CLAUDE.md`).
- **Cost model:** the owner's keys pay for every visitor's price and Claude lookups; the link is shared only with family and friends.

## What it deliberately lacks
Live (second-by-second) prices, daily change figures, AI features beyond import and fund lookups,
historical performance, multiple portfolios per person, login, syncing between devices (use Backup), and any
limit on how much a visitor can use the price and Claude lookups (the owner's API keys pay for them).

## Direction
Future tabs, each added as a new top-bar tab:
- **Portfolio Health** — diversification and concentration checks.
- **Crash Simulator** — estimated portfolio impact under historical or custom shocks.
- **Risk** — volatility, drawdown and exposure measures.
