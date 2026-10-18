import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_WIDTH, buildWorld } from "./world";

const topology = JSON.parse(fs.readFileSync(path.join(process.cwd(), "node_modules/world-atlas/countries-110m.json"), "utf8"));
const world = buildWorld(topology);

describe("buildWorld (Natural Earth 110m)", () => {
  it("draws the countries in a fixed drawing space with a sensible shape", () => {
    expect(world.width).toBe(MAP_WIDTH);
    expect(world.height).toBeGreaterThan(MAP_WIDTH * 0.4);
    expect(world.height).toBeLessThan(MAP_WIDTH * 0.7);
    expect(world.countries.length).toBeGreaterThan(160);
  });
  it("links the countries of the demo stocks to their codes", () => {
    const byCode = new Map(world.countries.map((c) => [c.code, c]));
    expect(byCode.get("US")?.name).toBe("United States of America");
    expect(byCode.get("TW")?.name).toBe("Taiwan");
    expect(byCode.get("NL")?.name).toBe("Netherlands");
    expect(byCode.get("JP")?.name).toBe("Japan");
    expect(byCode.get("GB")?.name).toBe("United Kingdom");
  });
  it("gives every drawn country path data and unique codes", () => {
    for (const c of world.countries) expect(c.d.startsWith("M")).toBe(true);
    const codes = world.countries.map((c) => c.code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("leaves Antarctica out", () => {
    expect(world.countries.some((c) => c.name === "Antarctica")).toBe(false);
  });
  it("keeps territories without a standard id, with no code", () => {
    expect(world.countries.find((c) => c.name === "Kosovo")?.code).toBeNull();
  });
  it("does not draw very small countries at this resolution (they appear in the list only)", () => {
    expect(world.countries.some((c) => c.name === "Singapore")).toBe(false);
  });
  it("keeps every path inside the drawing space", () => {
    for (const c of world.countries) {
      const nums = c.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < nums.length; i += 2) expect(nums[i]).toBeGreaterThanOrEqual(-1);
      for (let i = 1; i < nums.length; i += 2) expect(nums[i]).toBeLessThanOrEqual(world.height + 1);
    }
  });
});
