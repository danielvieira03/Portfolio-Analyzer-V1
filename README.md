# Portfolio Analyzer

A dark, terminal-style web app for analyzing an investment portfolio: allocation, sector tilts versus
the S&P 500, and a full holdings ledger — with CSV/Excel import.

<!-- Replace with a screenshot once the app is running: -->
<!-- ![Portfolio Analyzer dashboard](docs/screenshot.png) -->
> _Screenshot coming soon._

## Features
- **Dashboard** — portfolio value, cost basis, unrealized gain/loss, allocation donuts (asset class, equity sector, fixed-income maturity, alternatives type), top holdings
- **Holdings** — sortable tables per asset class, editable cash, add / edit / remove with validation
- **Market prices** — prices refresh automatically (hourly, one setting) and on demand from Financial Modeling Prep; adding a holding autofills name, price and (for stocks) sector; needs `FINANCIAL_MODELING_API_KEY`
- **Maturity / Type** — bond maturity and alternatives type columns, filled in by Claude with web search (about 3 to 5 cents per fund; needs `ANTHROPIC_API_KEY`)
- **Risk Analysis** — Risk Profile meter (1–5, from the asset-class mix) and equity sector weights vs. the S&P 500 with a plain-English over/underweight summary
- **Import** — CSV and Excel (flexible column matching, manual mapping), plus screenshots and PDFs read by Claude, always with a preview before anything is saved
- **Claude check** — CSV/Excel imports are automatically sanity-checked by Claude (data mistakes only; never blocks the import)
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
# optional: add FINANCIAL_MODELING_API_KEY to .env.local to enable automatic prices and ticker autofill
npm run dev                 # open http://localhost:3000
```

Other commands: `npm test` (unit tests), `npm run lint`, `npm run build`.

## Project docs
- [`docs/SPEC.md`](docs/SPEC.md) — what the app is and where it's heading
- [`CLAUDE.md`](CLAUDE.md) — conventions for AI-assisted development
