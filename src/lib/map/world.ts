// Turns the Natural Earth country data (the `world-atlas` package) into SVG paths for the world map card.
// Pure: no browser needed, so it is unit-tested.

import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature } from "topojson-client";
import { countryByNumeric } from "@/config/countries";

/** Width of the map's drawing space; the SVG scales it to the card, so this only sets the precision. */
export const MAP_WIDTH = 960;

export interface MapCountry {
  /** ISO two-letter code, or null for a few territories the data doesn't give a standard id (Kosovo, N. Cyprus, Somaliland). */
  code: string | null;
  name: string;
  /** SVG path data. */
  d: string;
}

export interface WorldMap {
  width: number;
  height: number;
  countries: MapCountry[];
}

/** Antarctica is left out: it takes a lot of space and holds no company headquarters. */
const ANTARCTICA_ID = 10;

export function buildWorld(topology: unknown): WorldMap {
  const topo = topology as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const all = feature(topo, topo.objects.countries).features;
  const shown = all.filter((f) => Number(f.id) !== ANTARCTICA_ID);

  const collection = { type: "FeatureCollection" as const, features: shown };
  const projection = geoNaturalEarth1().fitWidth(MAP_WIDTH, collection);
  const path = geoPath(projection);
  const height = Math.ceil(path.bounds(collection)[1][1]);

  const countries: MapCountry[] = [];
  for (const f of shown) {
    const d = path(f);
    if (!d) continue;
    const numeric = f.id === undefined ? NaN : Number(f.id);
    countries.push({ code: Number.isFinite(numeric) ? (countryByNumeric(numeric)?.code ?? null) : null, name: f.properties.name, d });
  }
  return { width: MAP_WIDTH, height, countries };
}
