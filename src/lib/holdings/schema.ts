// Validation for a holding, shared by the form (browser) and the server actions.

import { z } from "zod";
import { isValidSubtype, SUBTYPE_LABEL } from "@/config/subtypes";
import { DIVERSIFIED, SECTORS } from "@/lib/portfolio/sectors";
import { HOLDING_CLASSES } from "@/lib/portfolio/types";

export const SECTOR_OPTIONS = [...SECTORS, DIVERSIFIED] as const;

const positiveNumber = (label: string) =>
  z.number({ error: `${label} must be a number` }).positive(`${label} must be greater than 0`);
const nonNegativeNumber = (label: string) =>
  z.number({ error: `${label} must be a number` }).min(0, `${label} can't be negative`);

export const holdingSchema = z
  .object({
    ticker: z
      .string()
      .trim()
      .min(1, "Ticker is required")
      .max(12, "Ticker is too long")
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9.^=\-]+$/.test(v), "Use letters, numbers, . or -"),
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    assetClass: z.enum(HOLDING_CLASSES, { error: "Choose an asset class" }),
    sector: z.string().nullable(),
    subtype: z.string().nullish().transform((v) => v || null),
    /** Headquarters country of an individual stock (ISO two-letter code); filled from market data, never typed. */
    country: z.string().regex(/^[A-Z]{2}$/, "Not a country code").nullish().transform((v) => v || null),
    /** Dividend per share over the last year, filled from market data at each price refresh, never typed. */
    dividend: z.number().finite().min(0).max(1_000_000).nullish().transform((v) => v ?? null),
    shares: positiveNumber("Shares"),
    costBasisPerShare: nonNegativeNumber("Cost basis"),
    currentPrice: nonNegativeNumber("Price"),
  })
  .superRefine((v, ctx) => {
    if (v.assetClass !== "Equities" && v.sector) {
      ctx.addIssue({ code: "custom", path: ["sector"], message: "Sector applies to equities only" });
    }
    if (v.subtype) {
      if (v.assetClass === "Equities") {
        ctx.addIssue({ code: "custom", path: ["subtype"], message: "Maturity and type apply to bonds and alternatives only" });
      } else if (!isValidSubtype(v.assetClass, v.subtype)) {
        ctx.addIssue({ code: "custom", path: ["subtype"], message: `Unknown ${SUBTYPE_LABEL[v.assetClass].toLowerCase()}` });
      }
    }
    if (v.sector && !(SECTOR_OPTIONS as readonly string[]).includes(v.sector)) {
      ctx.addIssue({ code: "custom", path: ["sector"], message: "Unknown sector" });
    }
  });

export type HoldingInput = z.infer<typeof holdingSchema>;

export const cashSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).min(0, "Cash can't be negative").max(1e12, "Amount is too large"),
});

/** Field -> first error message, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
