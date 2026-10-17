# Portfolio Analyzer — instructions for Claude

Read `docs/SPEC.md` for the big picture before starting work. See `AGENTS.md` too:
this Next.js version differs from older ones — check `node_modules/next/dist/docs/` before writing Next code.

## What this is
A single-user web app that analyzes an investment portfolio (dark, dense, Bloomberg-style terminal look).
It is both a real tool for Daniel and a portfolio showpiece, so quality and visuals matter more than feature count.

## Working with Daniel
- Daniel is a finance graduate and cannot read code. Explain in plain English, keep steps small, say exactly how to run and check things.
- Do NOT add features he hasn't listed. Leave clean room for future tabs, build nothing for them.
- Build in checkpoints: finish, run the app, fix errors, `git commit`, explain how to view it, then STOP for feedback.
- Never push or touch the GitHub remote; Daniel connects it himself.

## Stack
Next.js (App Router) + TypeScript · Tailwind CSS v4 + shadcn/ui (base-ui) · Recharts · Prisma 7 + SQLite
(better-sqlite3 adapter) · SheetJS `xlsx` (Excel) · Anthropic SDK (screenshot/PDF import, optional review) · Vitest · npm.

## Commands
- `npm install` — installs and generates the Prisma client
- `npm run db:migrate` — create/update the local SQLite database
- `npm run dev` — run at http://localhost:3000
- `npm test` — unit tests · `npm run typecheck` · `npm run lint` · `npm run build`

## Folder map
- `src/app/` — routes (Dashboard `/`, Holdings `/holdings`, Risk Analysis `/risk`) and layout shell
- `src/components/layout/` top bar with horizontal tabs · `shared/` Panel, Num, PageHeader · `ui/` shadcn primitives
- `src/lib/portfolio/` — ALL portfolio math as pure, tested functions (value, cost, gain/loss, weights)
- `src/lib/holdings/` — validation (zod) shared by the form and server actions
- `src/lib/import/` — CSV/Excel parsing, flexible column matching, row cleanup + warnings
- `src/lib/ai/` — Claude calls: `claude.ts` is SERVER ONLY (reads the API key); `to-rows.ts` feeds AI output into the same importer; `client.ts` is the browser-side fetch helper
- `src/app/api/import/` — route handlers `extract` (screenshot/PDF) and `review` (double-check)
- `src/config/ai.ts` — the Claude model and upload limits (change the model here)
- `src/components/holdings/` — tables, add/edit/remove dialogs, cash card, import dialog
- `src/lib/format.ts` — the only place numbers are formatted (currency, percent, dates)
- `src/data/` — data layer; the only code that talks to Prisma
- `src/config/` — nav items and editable settings (S&P 500 sector weights + as-of date, risk weights and labels in `risk.ts`)
- `src/components/risk/` — Risk Analysis cards (Risk Profile meter); score math is `src/lib/portfolio/risk.ts`
- `prisma/` — schema and migrations; DB file `prisma/portfolio.db` is git-ignored
- `src/generated/` — generated Prisma client (git-ignored)

## Conventions
- UI → server actions → `src/data` → Prisma. UI never imports Prisma directly.
- Keep files small. Math lives only in `src/lib/portfolio`, with tests beside it (`*.test.ts`).
- Design tokens live in `src/app/globals.css` — change colours there only. Amber = accent.
  Green/red ONLY for gains/losses (`text-gain` / `text-loss`, or `<Num tone="auto">`).
- Numbers: use `<Num>` / `.num` (monospace, tabular, right-aligned) and `format.ts`.
- Charts use `--chart-1..6` (no green/red) and always have hover tooltips.
- Prices are manual (no live data, no daily change figures).
- AI: `ANTHROPIC_API_KEY` stays server-side (never `NEXT_PUBLIC_`, never in the browser). Claude output goes through the
  same importer checks and preview as CSV/Excel; the user always confirms before anything is saved.
- Secrets go in `.env.local` (git-ignored); keep `.env.example` current.
