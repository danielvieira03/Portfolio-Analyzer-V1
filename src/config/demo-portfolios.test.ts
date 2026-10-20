import { describe, expect, it } from "vitest";
import { fundDurations } from "@/lib/funds/duration";
import { holdingSchema } from "@/lib/holdings/schema";
import { allocationByClass, summarize } from "@/lib/portfolio/calc";
import { countryExposure } from "@/lib/portfolio/country-exposure";
import { lookThroughExposure } from "@/lib/portfolio/exposure";
import { durationType, topContributors } from "@/lib/portfolio/duration";
import { demoDoc, libraryFunds } from "@/lib/portfolio/ledger";
import { displayScore, riskLabel, riskScore } from "@/lib/portfolio/risk";
import { equitySectorAllocation } from "@/lib/portfolio/sector-allocation";
import { subtypeAllocation } from "@/lib/portfolio/subtype-allocation";
import { DEMO_PORTFOLIOS, type DemoId } from "./demo-portfolios";

const look = (id: DemoId) => {
  const d = demoDoc(id);
  const alloc = allocationByClass(d.holdings, d.cash);
  const share = (c: string) => alloc.find((s) => s.assetClass === c)?.weight ?? 0;
  const score = riskScore(alloc)!;
  return { d, share, score, countries: countryExposure(d.holdings, d.etfBreakdowns), sectors: equitySectorAllocation(d.holdings, d.etfBreakdowns) };
};
const near = (a: number, b: number, tol = 0.02) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("the demo portfolios", () => {
  it("are three, each worth about $500,000", () => {
    expect(DEMO_PORTFOLIOS.map((p) => p.id)).toEqual(["conservative", "global", "growth"]);
    for (const p of DEMO_PORTFOLIOS) {
      const d = demoDoc(p.id);
      const total = summarize(d.holdings, d.cash).totalValue;
      expect(total).toBeGreaterThan(480_000);
      expect(total).toBeLessThan(520_000);
    }
  });

  it("have only valid holdings (the same checks as the Add form) and valid saved fund weights", () => {
    for (const p of DEMO_PORTFOLIOS) {
      for (const h of p.holdings) {
        const r = holdingSchema.safeParse({ ticker: h.ticker, name: h.name, assetClass: h.assetClass, sector: h.sector, subtype: h.subtype ?? null, country: h.country ?? null, shares: h.shares, costBasisPerShare: h.cost, currentPrice: h.price });
        expect(r.success, `${p.id}:${h.ticker}`).toBe(true);
      }
      const d = demoDoc(p.id);
      for (const [t, b] of Object.entries(d.etfBreakdowns)) {
        expect(b.status, t).toBe("ok");
        expect(b.countries.reduce((s, c) => s + c.weight, 0), t).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it("Conservative Income: mostly bonds, low score, almost all US, all three maturities and two alternative types", () => {
    const { d, share, score, countries } = look("conservative");
    near(share("Fixed Income"), 0.6);
    near(share("Equities"), 0.1);
    near(share("Alternatives"), 0.15);
    near(share("Cash"), 0.15);
    expect(riskLabel(score)).toBe("Moderately Conservative");
    expect(displayScore(score)).toBeLessThan(2.5);
    expect(countries.rows[0].name).toBe("United States");
    expect(countries.rows[0].weight).toBeGreaterThan(0.85);
    expect(subtypeAllocation(d.holdings.filter((h) => h.assetClass === "Fixed Income"), "Fixed Income").slices.map((s) => s.label).sort()).toEqual(["Long-term", "Medium-term", "Short-term"]);
    expect(new Set(d.holdings.filter((h) => h.assetClass === "Alternatives").map((h) => h.subtype)).size).toBe(2);
  });

  it("Global Diversified: moderate score and a wide spread of countries", () => {
    const { share, score, countries } = look("global");
    near(share("Equities"), 0.35);
    near(share("Fixed Income"), 0.45);
    near(share("Alternatives"), 0.15);
    expect(riskLabel(score)).toBe("Moderate");
    expect(countries.rows.length).toBeGreaterThanOrEqual(15);
    expect(countries.rows[0].name).toBe("United States");
    expect(countries.rows[0].weight).toBeLessThan(0.6);
  });

  it("Aggressive Growth: 85% stocks, aggressive score, tech-heavy, and the biggest economies on the map", () => {
    const { share, score, countries, sectors } = look("growth");
    near(share("Equities"), 0.85);
    expect(riskLabel(score)).toBe("Aggressive");
    const biggest = ["United States", "China", "Japan", "India", "Germany", "United Kingdom"];
    const named = countries.rows.map((r) => r.name);
    for (const c of biggest) expect(named, c).toContain(c);
    const topSector = sectors.slices.find((s) => s.kind === "sector")!;
    expect(topSector.label).toBe("Information Technology");
    expect(topSector.weight).toBeGreaterThan(0.3);
  });
});

describe("the demo portfolios' bond fund durations", () => {
  const durationOf = (id: DemoId) => {
    const d = demoDoc(id);
    const bonds = d.holdings.filter((h) => h.assetClass === "Fixed Income");
    const durations = fundDurations(d.holdings, libraryFunds(d, bonds.map((h) => h.ticker)), d.durations);
    return { bonds, view: lookThroughExposure(d.holdings, d.etfBreakdowns, { durations }).duration };
  };
  it("every demo bond fund has a duration in the built-in library, so a demo never needs a lookup", () => {
    for (const p of DEMO_PORTFOLIOS) {
      const { bonds, view } = durationOf(p.id);
      expect(view.withoutDuration, p.id).toEqual([]);
      expect(view.rows.length, p.id).toBe(bonds.length);
    }
  });
  it("show a different duration type each", () => {
    const conservative = durationOf("conservative").view.average!;
    const global = durationOf("global").view.average!;
    const growth = durationOf("growth").view.average!;
    expect(conservative).toBeGreaterThan(5);
    expect(conservative).toBeLessThan(5.3);
    expect(durationType(conservative)).toBe("Intermediate Duration");
    expect(durationType(global)).toBe("Intermediate Duration");
    expect(durationType(growth)).toBe("Ultra-Short Duration");
  });
});

describe("the demo portfolios' duration contributors", () => {
  const top = (id: DemoId) => {
    const d = demoDoc(id);
    const bonds = d.holdings.filter((h) => h.assetClass === "Fixed Income");
    const durations = fundDurations(d.holdings, libraryFunds(d, bonds.map((h) => h.ticker)), d.durations);
    return topContributors(lookThroughExposure(d.holdings, d.etfBreakdowns, { durations }).duration);
  };
  it("Conservative Income: the 20+ year Treasury fund adds the most (about 39% of the duration from 13% of the bonds)", () => {
    const t = top("conservative");
    expect(t).toHaveLength(5);
    expect(t[0].ticker).toBe("TLT");
    expect(t[0].shareOfDuration).toBeGreaterThan(0.37);
    expect(t[0].shareOfDuration).toBeLessThan(0.41);
    expect(t[0].weight).toBeGreaterThan(0.12);
    expect(t[0].weight).toBeLessThan(0.14);
  });
  it("Aggressive Growth: its single bond fund is 100% of the duration", () => {
    const t = top("growth");
    expect(t).toHaveLength(1);
    expect(t[0].shareOfDuration).toBeCloseTo(1);
  });
});
