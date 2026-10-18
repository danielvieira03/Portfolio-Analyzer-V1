import { describe, expect, it } from "vitest";
import { countryLabel } from "./country-label";

describe("countryLabel", () => {
  it("shows the country name for a stock", () => {
    expect(countryLabel({ country: "NL", sector: "Information Technology" })).toBe("Netherlands");
  });
  it("shows Diversified for a broad fund with no country", () => {
    expect(countryLabel({ country: null, sector: "Diversified" })).toBe("Diversified");
    expect(countryLabel({ country: undefined, sector: "Diversified" })).toBe("Diversified");
  });
  it("shows the country for a single-country fund even though its sector is Diversified (e.g. a Brazil ETF)", () => {
    expect(countryLabel({ country: "BR", sector: "Diversified" })).toBe("Brazil");
  });
  it("is empty for a stock whose country is not known yet", () => {
    expect(countryLabel({ country: null, sector: "Energy" })).toBe("");
    expect(countryLabel({ country: null, sector: null })).toBe("");
  });
});
