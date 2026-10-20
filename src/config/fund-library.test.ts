import { describe, expect, it } from "vitest";
import { FUND_LIBRARY } from "./fund-library";
import { isValidSubtype } from "./subtypes";

describe("FUND_LIBRARY", () => {
  it("has 21 bond and 20 alternatives funds", () => {
    expect(FUND_LIBRARY.filter((f) => f.assetClass === "Fixed Income")).toHaveLength(21);
    expect(FUND_LIBRARY.filter((f) => f.assetClass === "Alternatives")).toHaveLength(20);
  });
  it("has unique upper-case tickers", () => {
    const tickers = FUND_LIBRARY.map((f) => f.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const t of tickers) expect(t).toBe(t.toUpperCase());
  });
  it("only uses values the app allows for each class", () => {
    for (const f of FUND_LIBRARY) expect(isValidSubtype(f.assetClass, f.subtype), f.ticker).toBe(true);
  });
  it("gives every bond fund a plausible duration and no alternative one", () => {
    for (const f of FUND_LIBRARY) {
      if (f.assetClass === "Fixed Income") expect(f.duration! > 0 && f.duration! < 30, f.ticker).toBe(true);
      else expect(f.duration).toBeUndefined();
    }
  });
  it("never uses the 'unknown' values", () => {
    for (const f of FUND_LIBRARY) expect(f.subtype).not.toBe("Not specified");
  });
});
