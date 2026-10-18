# Portfolio Analyzer — instructions for Claude

Read `docs/SPEC.md` for the big picture before starting work. See `AGENTS.md` too:
this Next.js version differs from older ones — check `node_modules/next/dist/docs/` before writing Next code.

## What this is
A web app that analyzes an investment portfolio (dark, dense, Bloomberg-style terminal look). Each visitor's portfolio is
saved in their OWN browser (no logins, no server database), so the app can be shared as a link; the server only holds the API keys.
It is both a real tool for Daniel and a portfolio showpiece, so quality and visuals matter more than feature count.

## Working with Daniel
- Daniel is a finance graduate and cannot read code. Explain in plain English, keep steps small, say exactly how to run and check things.
- Do NOT add features he hasn't listed. Leave clean room for future tabs, build nothing for them.
- Build in checkpoints: finish, run the app, fix errors, `git commit`, explain how to view it, then STOP for feedback.
- Push to origin/main only when Daniel says so, and tag each pushed version (v0.x). Never push on your own.

## Stack
Next.js (App Router) + TypeScript · Tailwind CSS v4 + shadcn/ui (base-ui) · Recharts · browser `localStorage` for data ·
SheetJS `xlsx` (Excel) · Anthropic SDK (screenshot/PDF import, optional review) · Vitest · npm.

## Commands
- `npm install` — installs packages
- `npm run dev` — run at http://localhost:3000
- `npm test` — unit tests · `npm run typecheck` · `npm run lint` · `npm run build`

## Folder map
- `src/app/` — routes (Dashboard `/`, Holdings `/holdings`, Risk Analysis `/risk`) and layout shell
- `src/components/layout/` top bar with horizontal tabs · `shared/` Panel, Num, PageHeader · `ui/` shadcn primitives
- `src/lib/portfolio/` — ALL portfolio math as pure, tested functions (value, cost, gain/loss, weights); `ledger.ts` = every rule for changing a saved portfolio (add/edit/remove/import/prices/fund library); `document.ts` = reading the saved portfolio and the backup file safely
- `src/lib/market/` — market data: `fmp.ts` is SERVER ONLY (reads the key); `profile.ts` (parse + sector), `refresh-plan.ts` are pure and tested
- `src/lib/storage/` — the browser store (`portfolio-store.ts`, saves to localStorage, works with `useSyncExternalStore`), the screens' change functions (`browser.ts`, BROWSER ONLY), price refresh and ticker lookup logic
- `src/components/providers/` — `usePortfolio()` hook (null until the browser data is read) and `StorageGuard` (tab sync, notices); `src/components/views/` — Dashboard/Holdings/Risk screens
- `src/lib/holdings/` — validation (zod) shared by the form, the import and the backup
- `src/lib/import/` — CSV/Excel parsing, flexible column matching, row cleanup + warnings
- `src/lib/ai/` — Claude calls: `claude.ts` is SERVER ONLY (reads the API key); `to-rows.ts` feeds AI output into the same importer; `client.ts` is the browser-side fetch helper
- `src/app/api/import/` — route handlers `extract` (screenshot/PDF) and `review` (double-check)
- `src/config/ai.ts` — the Claude model and upload limits (change the model here)
- `src/config/subtypes.ts` — allowed Maturity (Fixed Income) / Type (Alternatives) values; `src/config/fund-library.ts` — the starting fund library (verified bond figures); `src/lib/funds/` — pure library logic (`splitKnown`, `resolveSubtypes`: the visitor's browser library first, then Claude, then save in the browser); `src/lib/ai/classify.ts` looks unknown funds up with Claude + web search (route `src/app/api/holdings/classify`)
- `src/components/holdings/` — tables, add/edit/remove dialogs, cash card, import dialog, backup dialog
- `src/lib/format.ts` — the only place numbers are formatted (currency, percent, dates)
- `src/config/` — nav items and editable settings (price refresh interval and sector name map in `market.ts`, S&P 500 sector weights + as-of date, risk weights and labels in `risk.ts`)
- `src/components/risk/` — Risk Analysis cards (Risk Profile meter, sector weights vs the S&P 500, over/underweight summary); score math is `src/lib/portfolio/risk.ts`

## Conventions
- Data lives in the visitor's browser: UI → `src/lib/storage/browser.ts` → pure rules in `src/lib/portfolio/ledger.ts` → browser store. The server has NO database and stores nothing about anyone's portfolio; server actions/routes are stateless (they receive tickers or files, call the market data / Claude API with the server's keys, and return answers).
- Keep files small. Math lives only in `src/lib/portfolio`, with tests beside it (`*.test.ts`).
- Design tokens live in `src/app/globals.css` — change colours there only. Amber = accent.
  Green/red ONLY for gains/losses (`text-gain` / `text-loss`, or `<Num tone="auto">`).
- Numbers: use `<Num>` / `.num` (monospace, tabular, right-aligned) and `format.ts`.
- Charts use `--chart-1..9` (no green/red) and always have hover tooltips.
- Prices come from Financial Modeling Prep (`src/lib/market/`, refreshed hourly and via the Holdings Refresh button; the interval is `PRICE_REFRESH_MINUTES` in `src/config/market.ts`). A ticker with no price keeps its manual price and is flagged quietly. No daily change figures. The free plan allows 250 calls a day.
- Market data: `FINANCIAL_MODELING_API_KEY` stays server-side too (only `src/lib/market/fmp.ts` reads it; never `NEXT_PUBLIC_`, never logged or returned).
- AI: `ANTHROPIC_API_KEY` stays server-side (never `NEXT_PUBLIC_`, never in the browser). Claude output goes through the
  same importer checks and preview as CSV/Excel; the user always confirms before anything is saved.
- Secrets go in `.env.local` (git-ignored); keep `.env.example` current.
