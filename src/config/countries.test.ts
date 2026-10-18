import { describe, expect, it } from "vitest";
import { COUNTRIES, countryByCode, countryByNumeric, countryName } from "./countries";

describe("COUNTRIES", () => {
  it("has the 249+ ISO countries with unique codes and ids", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(249);
    expect(new Set(COUNTRIES.map((c) => c[0])).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c[1])).size).toBe(COUNTRIES.length);
  });
  it("uses two upper-case letters and a positive numeric id", () => {
    for (const [code, numeric, name] of COUNTRIES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(numeric).toBeGreaterThan(0);
      expect(name.length).toBeGreaterThan(1);
    }
  });
  it("knows the countries of the demo stocks", () => {
    expect(countryByCode("US")).toMatchObject({ numeric: 840, name: "United States" });
    expect(countryByCode("TW")).toMatchObject({ numeric: 158, name: "Taiwan" });
    expect(countryByCode("NL")).toMatchObject({ numeric: 528, name: "Netherlands" });
    expect(countryByCode("JP")).toMatchObject({ numeric: 392, name: "Japan" });
    expect(countryByCode("GB")?.name).toBe("United Kingdom");
    expect(countryByCode("KR")?.name).toBe("South Korea");
  });
  it("looks up by numeric id and by lower-case code", () => {
    expect(countryByNumeric(840)?.code).toBe("US");
    expect(countryByCode("us")?.code).toBe("US");
    expect(countryByCode("ZZ")).toBeUndefined();
    expect(countryByNumeric(999999)).toBeUndefined();
  });
  it("names a code, falls back to the code, and gives nothing for no code", () => {
    expect(countryName("de")).toBe("Germany");
    expect(countryName("ZZ")).toBe("ZZ");
    expect(countryName(null)).toBe("");
    expect(countryName("")).toBe("");
  });
});
