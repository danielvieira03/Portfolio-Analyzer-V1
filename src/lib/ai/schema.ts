// The exact shapes Claude must answer in (enforced by structured outputs).

import { z } from "zod";

export const extractedHoldingSchema = z.object({
  ticker: z.string().describe("Ticker symbol exactly as shown, e.g. AAPL"),
  name: z.string().nullable().describe("Company or fund name if shown, else null"),
  shares: z.number().nullable().describe("Number of shares/units held, else null"),
  costPerShare: z.number().nullable().describe("Average cost PER SHARE if shown, else null"),
  totalCost: z.number().nullable().describe("Total cost basis of the whole position if shown, else null"),
  price: z.number().nullable().describe("Current price per share if shown, else null"),
  marketValue: z.number().nullable().describe("Current market value of the whole position if shown, else null"),
  assetClass: z.enum(["Equities", "Fixed Income", "Alternatives", "Cash"]).nullable()
    .describe("Best guess: stocks and equity ETFs = Equities, bond funds = Fixed Income, gold/silver/commodities/real estate = Alternatives"),
  sector: z.string().nullable()
    .describe("GICS sector for an individual stock (e.g. Information Technology), 'Diversified' for broad equity funds, else null"),
  confidence: z.enum(["high", "medium", "low"]).describe("How sure you are that every number in this row was read correctly"),
  note: z.string().nullable().describe("Short note if anything in this row was unclear, blurry, cut off or inferred, else null"),
});

export const extractionSchema = z.object({
  holdings: z.array(extractedHoldingSchema),
  cashAmount: z.number().nullable().describe("Cash / money-market balance if shown as a separate line, else null"),
  issues: z.array(z.string()).describe("Anything on the whole document that was unreadable, ambiguous or looked inconsistent"),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const reviewSchema = z.object({
  flags: z.array(
    z.object({
      ticker: z.string(),
      severity: z.enum(["info", "warning"]),
      message: z.string().describe("One short sentence a non-programmer can act on"),
    }),
  ),
  summary: z.string().describe("One or two sentences: overall impression of the data"),
});
export type Review = z.infer<typeof reviewSchema>;
