"use client";

import { useEffect, useRef, useState } from "react";
import { Num } from "@/components/shared/num";
import { Panel } from "@/components/shared/panel";
import { countryName } from "@/config/countries";
import { formatPercent } from "@/lib/format";
import { exposureOpacity } from "@/lib/map/shade";
import type { WorldMap } from "@/lib/map/world";
import type { CountryExposure } from "@/lib/portfolio/country-exposure";

let cachedWorld: WorldMap | null = null;

/** Loads the map data only when this card is shown, so the other pages stay light. */
function useWorld(): WorldMap | null {
  const [world, setWorld] = useState<WorldMap | null>(cachedWorld);
  useEffect(() => {
    if (cachedWorld) return;
    let cancelled = false;
    Promise.all([import("@/lib/map/world"), import("world-atlas/countries-110m.json")])
      .then(([builder, topology]) => {
        cachedWorld = builder.buildWorld(topology.default);
        if (!cancelled) setWorld(cachedWorld);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return world;
}

interface Hover {
  index: number;
  x: number;
  y: number;
  /** Width of the map box, so the tooltip can flip to the left near the right edge. */
  width: number;
}

/** World map shaded by where the individual stocks are based, with the countries listed beside it. */
export function CountryExposureCard({ exposure }: { exposure: CountryExposure }) {
  const world = useWorld();
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const rows = exposure.rows;
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const maxWeight = rows[0]?.weight ?? 0;
  const drawn = new Set(world?.countries.map((c) => c.code).filter(Boolean));
  const notDrawn = world ? rows.filter((r) => !drawn.has(r.code)) : [];

  const track = (index: number, e: React.PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (box) setHover({ index, x: e.clientX - box.left, y: e.clientY - box.top, width: box.width });
  };

  const hovered = hover && world ? world.countries[hover.index] : null;
  const hoveredRow = hovered?.code ? byCode.get(hovered.code) : undefined;
  const hoveredName = hovered ? (hovered.code ? countryName(hovered.code) : hovered.name) : "";

  const summary = rows.slice(0, 3).map((r) => `${r.name} ${formatPercent(r.weight, 0)}`).join(", ");

  return (
    <Panel title="Individual Stock Exposure by Country">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          No individual stocks with a country yet. Countries fill in after the next price refresh.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0">
            <div ref={boxRef} className="relative">
              {world ? (
                <svg
                  viewBox={`0 0 ${world.width} ${world.height}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`World map shaded by the share of individual stocks based in each country. ${summary}.`}
                  onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
                >
                  <rect width={world.width} height={world.height} fill="transparent" onPointerDown={() => setHover(null)} />
                  {world.countries.map((c, i) => {
                    const row = c.code ? byCode.get(c.code) : undefined;
                    const opacity = row ? exposureOpacity(row.weight, maxWeight) : 0;
                    return (
                      <path
                        key={c.code ?? c.name}
                        d={c.d}
                        data-code={c.code ?? undefined}
                        style={opacity > 0 ? { fill: "var(--primary)", fillOpacity: opacity } : { fill: "var(--accent)" }}
                        stroke="var(--panel)"
                        strokeWidth={0.6}
                        onPointerEnter={(e) => track(i, e)}
                        onPointerMove={(e) => track(i, e)}
                      />
                    );
                  })}
                  {hovered && <path d={hovered.d} fill="none" stroke="var(--foreground)" strokeWidth={1.4} pointerEvents="none" />}
                </svg>
              ) : (
                <div className="aspect-[2/1] w-full animate-pulse rounded bg-muted/40" aria-busy="true" />
              )}
              {hover && hovered && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[12px] shadow-md"
                  style={{
                    left: hover.x,
                    top: hover.y,
                    transform: `translate(${hover.x > hover.width * 0.6 ? "calc(-100% - 12px)" : "12px"}, ${hover.y > 40 ? "-130%" : "12px"})`,
                  }}
                >
                  <p className="font-medium">{hoveredName}</p>
                  <p className="num !text-left text-muted-foreground">
                    {hoveredRow ? `${formatPercent(hoveredRow.weight, 1)} of stocks` : "No exposure"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="label-caps flex justify-between border-b pb-1.5">
              <span>Country</span>
              <span>Share of stocks</span>
            </div>
            <ul className="max-h-72 overflow-y-auto pr-1 xl:max-h-[22rem]">
              {rows.map((r) => (
                <li key={r.code} className="flex items-center gap-2 border-b border-border/50 py-1.5 last:border-0">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-primary"
                    style={{ opacity: exposureOpacity(r.weight, maxWeight) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <Num className="font-medium">{formatPercent(r.weight, 1)}</Num>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Individual stocks only: funds, bonds, alternatives and cash are excluded. By country of company headquarters.
        {exposure.withoutCountry > 0 &&
          ` ${exposure.withoutCountry} ${exposure.withoutCountry === 1 ? "stock has" : "stocks have"} no country yet.`}
        {notDrawn.length > 0 && ` Too small to draw at this map size: ${notDrawn.map((r) => r.name).join(", ")}.`}
      </p>
    </Panel>
  );
}
