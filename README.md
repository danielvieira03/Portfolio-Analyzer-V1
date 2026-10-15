# Portfolio Analyzer

A dark, terminal-style web app for analyzing an investment portfolio: allocation, sector tilts versus
the S&P 500, and a full holdings ledger — with CSV/Excel import.

<!-- Replace with a screenshot once the app is running: -->
<!-- ![Portfolio Analyzer dashboard](docs/screenshot.png) -->
> _Screenshot coming soon._

## Features
- **Dashboard** — portfolio value, cost basis, unrealized gain/loss, allocation donut, sector vs. S&P 500, top holdings
- **Holdings** — sortable tables per asset class, editable cash, add / edit / remove with validation
- **Import** — CSV and Excel (flexible column matching, manual mapping), plus screenshots and PDFs read by Claude, always with a preview before anything is saved
- **Double-check with Claude** — optional AI sanity review of an import preview
- **Demo portfolio** — realistic ~$500K sample data on first run, removable in one click
- Single user, local data, no login

## Tech stack
Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Prisma + SQLite · SheetJS · Claude API (Anthropic SDK) · Vitest

## Run it locally
Requires Node.js 20+.

```bash
npm install                 # install packages (also prepares the database client)
cp .env.example .env.local  # local settings
npm run db:migrate          # create the local SQLite database
# optional: add ANTHROPIC_API_KEY to .env.local to enable screenshot/PDF import
npm run dev                 # open http://localhost:3000
```

Other commands: `npm test` (unit tests), `npm run lint`, `npm run build`.

## Project docs
- [`docs/SPEC.md`](docs/SPEC.md) — what the app is and where it's heading
- [`CLAUDE.md`](CLAUDE.md) — conventions for AI-assisted development
