# Portfolio Analyzer — Spec (big picture)

Current release: **v1.7** (live on Vercel).

## What it is
A web app for analyzing an investment portfolio. Positions are entered by hand or imported
from CSV/Excel, saved **in the visitor's own browser** (no accounts, no server database: each person who opens the
app has their own private portfolio), and shown in a dark, dense, terminal-style interface. The server only holds the
API keys and does market data and Claude lookups for the browser.
It is a rebuild of an earlier plain HTML/JS version, with the emphasis on quality, structure and visuals.

## What it has now
- **Dashboard** — total value, cost basis, unrealized gain/loss and cash; allocation by asset
  class and by equity sector (stocks plus equity ETFs split across their sectors; top 7 sectors, "Unclassified" for what has no sector data, the rest grouped as "Other" with a hover
  card listing them), by fixed-income maturity and by alternatives type; top 5 holdings; and **Exposure by Country**: an SVG world map
  (Natural Earth data, drawn with d3-geo; no images or paid map services) plus a list of countries with percentages. Countries with no
  exposure are muted grey; countries with exposure go from a faint to full amber on a square-root scale (so small exposures stay visible);
  hovering a country shows its name and share. Percentages are shares of the holdings that have a country; Equity and Fixed Income are included (ETFs and bond funds are split by their country weights), Alternatives and cash are not, and the card says so; the part with no country is shown as "Unclassified" in the small print. The map uses the 110m Natural Earth resolution, so very small countries
  (e.g. Singapore) appear in the list but are not drawn.
- **Holdings** — one sortable table per asset class (Equities, Fixed Income, Alternatives), a separate
  cash card, add/edit/remove (adding an existing ticker offers to average it in or replace it), and import
  with a preview. The Equities table's last column is **Country**: an individual stock's headquarters country (from market data,
  stored hidden on the holding, filled on the next price refresh), or "Diversified" for equity ETFs and funds. When ETFs get country
  data, they stay "Diversified" unless they obviously track one country (e.g. a Brazil ETF shows Brazil).
- **Look-through exposure** — ONE shared, tested function (`lookThroughExposure`, `src/lib/portfolio/exposure.ts`) works out exposure by sector and by country for stocks and funds. A stock counts 100% to its own sector and country; a fund's value is split by its weights from the market data provider (e.g. $10,000 in an ETF that is 30% Technology adds $3,000 to Technology), and what the weights don't cover, or a fund with no data, is "Unclassified". Scope per view: sectors count Equities only; countries count Equities and Fixed Income; Alternatives are in neither. Each fund's weights are saved in the visitor's browser with a last-updated date (in Backup too) and looked up again about weekly (2 calls per equity ETF, 1 per bond fund; at most 50 funds per refresh), not on every refresh; if the provider hits a limit, a plan restriction or fails, the saved weights stay and the Holdings tab shows a quiet note. **Rule for the future: any new exposure feature (such as bond duration cards) must use this function so it covers stocks, ETFs, bond funds and alternatives, not equities only.**
- **Fixed Income Duration** (card on Risk Analysis, below the sector comparison) — the average duration of the bond funds, weighted by market value, and the duration type: under 1 year Ultra-Short, 1 up to 3 Short, 3 up to 7 Intermediate, 7 and over Long (compared on the one-decimal number shown, so the number and label never disagree). It is the third view of `lookThroughExposure` (scope: Fixed Income). A fund's duration comes from the built-in fund library (issuer figures), then from durations looked up for this visitor; a bond fund with none is looked up automatically by Claude (web search, never an estimate) and saved in the browser (`durations`, in Backup too). If Claude finds none, the fund is left out of the average, the card says so, and it is tried again after a week. Beside it, **Duration Contributors** lists the top 5 bond funds (all of them if fewer than 5) by how much each adds to the average: its share of fixed income (of the funds that have a duration), its own duration, what it adds in years (duration times share, adding up to the average) and its share of the total duration; the cards stack on narrow screens. The Fixed Income by Maturity card on the Dashboard is separate and unchanged.
- **Risk Analysis** — equity sector weights (stocks plus equity ETFs, split across their sectors) versus the S&P 500 (with a plain-English over/underweight summary beside it), plus a Risk Profile meter (1 Conservative to 5 Aggressive) scored from what you hold: each holding is scored by what it is and the score is the average
  weighted by market value (scores editable in `src/config/risk.ts`, `portfolioRisk` in `src/lib/portfolio/risk.ts`): **cash 1.0**; **bond funds by their own duration**
  (under 1 yr 1.5, 1 to 3 yrs 2.0, 3 to 7 yrs 2.5, 7+ yrs 3.0); **alternatives by type** (infrastructure 3.2, REITs 3.4, commodities 3.8, crypto 5.0, other or no type 3.5);
  **equities by S&P 500 sector** (Consumer Staples 3.5, Utilities 3.6, Health Care 3.7, Industrials 3.9, Real Estate 4.0, Materials 4.1, Financials 4.2, Communication Services 4.3,
  Consumer Discretionary 4.4, Energy 4.6, Information Technology 4.8), with equity ETFs split across their sectors by the shared look-through function. The names, cut-offs and
  look of the meter are unchanged. A holding whose sector or duration is unknown is left out of the score (never guessed) and the small print under the meter says how much
  of the portfolio the score covers and which tickers are missing. **Missing data is closed automatically** (`DataAutoFill`, `src/lib/storage/data-fill.ts`): a stock with no sector
  is filled from the market profile during the normal price refresh (no extra call), then by Claude if still blank; an equity ETF the market data has no sector weights for gets them read
  from the fund's page by Claude (saved as that fund's weights, marked `source: "claude"`, replaced by the market data's as soon as it has them and never erased by its "no data");
  a bond fund with no duration is looked up by Claude (the tracked index's duration is accepted when the fund's own isn't published, never an estimate). Each lookup that
  finds nothing is tried again only after a week. Because equities now score 3.5 to 4.8 instead of a flat 5, a typical all-stock portfolio lands near 4.3 (the S&P 500 itself is about 4.3),
  so "Aggressive" (4.5+) needs heavy technology, energy or crypto.
- **Income** (tab after Risk Analysis) — expected annual income from Equities (stocks and equity ETFs), Fixed Income and Alternatives that pay, as one expected figure (the shared function still works out a low and high of -10% / +10%, but the screen does not show them), computed by one shared function (`portfolioIncome`, `src/lib/portfolio/income.ts`) from each holding's dividend per share (saved at every price refresh, no extra API call) x shares; shows total, average monthly income, portfolio yield, a Sankey of the top 3 income holdings per category, and a section per category (yield on the whole category value, top 5 plus "Show all"); pre-tax, no reinvestment, cash interest excluded, holdings with no dividend data are "unavailable" and never guessed.
- **Ask AI** (tab after Income) — a chat that answers questions about the visitor's portfolio with Claude (streamed replies, four example questions, Clear chat, conversation kept in memory only, last 6 messages sent, 10 questions per hour per visitor, 500-character questions, 900-token replies, 2,000 when it may search). The browser sends a compact snapshot of numbers the app already calculates (`buildPortfolioSnapshot`, `src/lib/ai/snapshot.ts`; shared functions only) to `/api/chat`, which holds the key and answers only from that data (model: `CHAT_MODEL` in `src/config/ai.ts`; the snapshot block uses prompt caching). For outside or current information the data can't answer (e.g. what is happening in the bond market now) Claude may search the web: at most 2 searches per question, a hard estimated cost ceiling of 20 cents (`WEB_COST_CAP_USD`, prices in `CHAT_PRICES`), and 5 web-assisted questions per visitor per hour (after that it answers from the data only); the answer is labelled "Used web search" with its sources. Analysis, not personalized advice; nothing is stored on the server.
- **Maturity and Type** — Fixed Income holdings have a Maturity (short / medium / long-term / not specified) and
  Alternatives a Type (commodities, REITs, crypto, infrastructure, other), as sortable columns and form fields.
  Missing values are filled automatically in the import preview, or with the "Look up with Claude" button on the
  Holdings page. A **fund library** answers first, for free: it starts with 20 well-known bond funds
  and 20 alternatives funds (`src/config/fund-library.ts`; bond figures read from iShares and Vanguard pages, including
  each fund's duration in years, shown in the Fixed Income Duration card on Risk Analysis). Only funds the library doesn't know are searched by Claude
  (about 3 to 5 cents per fund), and what Claude finds is saved to the library **in that visitor's browser** (the built-in
  list ships with the app; nothing is shared between visitors) so that fund is not searched again for them
  (a bond fund Claude can't pin down is not saved). Values you set yourself are never overwritten. The allowed values
  live in `src/config/subtypes.ts`.
- **Market prices** — every holding's price comes from Financial Modeling Prep (profile lookup, one call per holding; the browser sends its own tickers and saves the answers, the server stores nothing):
  refreshed automatically every 2 minutes while the app is open (`PRICE_REFRESH_MINUTES` in `src/config/market.ts`), and on
  demand with the **Refresh** button on the Holdings tab, which also shows when prices were last updated. A ticker with no
  price available keeps the price you entered and shows a quiet "manual" tag. In the Add/Edit form, typing a ticker (as soon as the typing pauses for a moment, no need to leave the field)
  fills the name and price (and, in the Equities form, the sector: the stock's own sector, or "Diversified" for an ETF; bonds and alternatives get none), plus the Maturity / Type in the Fixed Income / Alternatives forms when the fund library knows the fund (free; unknown funds stay empty for the Look up button). The provider's sector names
  The form keeps asset classes apart: a stock typed under Fixed Income or Alternatives, or a fund the library or FMP's fund category places in another class (a bond fund under Equities, an equity ETF under Alternatives), fills nothing and cannot be added; it says which class it belongs under. A fund whose category is unclear or mixed is never refused (one extra FMP call per ETF typed in the form, none during the price refresh). All boxes start empty (no example text). are translated to the app's S&P 500 style names in `src/config/market.ts`. The Starter plan allows 300 calls a minute (the free plan only about 250 a day, which a
  2-minute refresh would use up quickly); if a limit is hit, the refresh stops quietly, old prices stay, and the Holdings tab says
  "Limit hit. Try again in a few seconds."
- **Import** (button on both Dashboard and Holdings) — CSV/Excel (parsed locally, tolerant of different column names, with manual column matching)
  and Screenshot/PDF (read by Claude). The first step of Import is choosing "Add additional holdings" or "New portfolio". The
  preview looks like the Holdings table; in Add mode repeated tickers are flagged, averaged by default, and can be
  unticked. CSV/Excel files get an automatic "Claude check" (parsed rows only, text, no file) that flags data mistakes only; it never blocks the import.
  When the preview opens, every holding's **latest market price** replaces the price in the file (the file's price is only as fresh as the file; a ticker the market data has no price for keeps the file's, and rows with a newer price are marked "latest"), and whatever else the file left blank is looked up before anything is saved: a stock's sector and country from market data (an ETF becomes "Diversified"), then Claude for what market data can't answer (sectors; maturity / type for bond and alternatives funds, the fund library first). Looked-up values are marked "looked up", the Import button waits until the lookups finish, and a quiet note counts rows still blank. Values in the file are never replaced.
- **Backup** (button on Holdings) — because the portfolio lives in one browser, you can download it as a file and restore it
  later, or move it to another browser or device. Restoring replaces the current portfolio after a confirm step.
- **Home page** (`/`) — a short intro and two options: **Choose a demo portfolio** (page `/demos`, with the three ~$500K demos) and **Upload your own portfolio** (page `/upload`, with three buttons: CSV or Excel, Screenshot, PDF; the chosen file opens the same import preview as the Import button on Holdings, and a visitor who already has a portfolio of their own picks Add or Replace first). Each demo is built to show something different:
  *Conservative Income* (about 10% stocks, 60% bonds, 15% alternatives, 15% cash: low risk score, bond maturities, gold and REITs, almost all US),
  *Global Diversified* (35/45/15/5: moderate score, many countries on the map through international and emerging-market funds) and
  *Aggressive Growth* (85% stocks: high score, tech-heavy sectors versus the S&P 500, the biggest economies). Their fund weights are saved with them, so every
  view works with no lookup. A new visitor has no portfolio until they pick one (inner pages send them home); a visitor who already has their own portfolio sees
  "Continue with my portfolio" and is warned before a demo replaces it. Demo portfolios are badged and removable.

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
historical performance, multiple portfolios per person, login, syncing between devices (use Backup), exposure data for Alternatives (they are outside the sector and country views for now), a single-country ETF showing a country in the Holdings table (it still says "Diversified"), and any
limit on how much a visitor can use the price and Claude lookups (the owner's API keys pay for them).

## Direction
Future tabs, each added as a new top-bar tab:
- **Portfolio Health** — diversification and concentration checks.
- **Crash Simulator** — estimated portfolio impact under historical or custom shocks.
- **Risk** — volatility, drawdown and exposure measures.
