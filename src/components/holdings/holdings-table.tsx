"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Num } from "@/components/shared/num";
import { countryName } from "@/config/countries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedCurrency,
  formatSignedPercent,
  formatCurrency,
} from "@/lib/format";
import { gainLoss, gainLossPct, marketValue, weight } from "@/lib/portfolio/calc";
import { sortPositions, type SortDir, type SortKey } from "@/lib/portfolio/sort";
import type { HoldingClass, Position } from "@/lib/portfolio/types";
import { cn } from "@/lib/utils";

interface Column {
  key: SortKey;
  label: string;
  numeric: boolean;
  /** Only shown in the table of this asset class. */
  only?: HoldingClass;
}

const COLUMNS: Column[] = [
  { key: "ticker", label: "Ticker", numeric: false },
  { key: "name", label: "Name", numeric: false },
  { key: "sector", label: "Sector", numeric: false, only: "Equities" },
  { key: "subtype", label: "Maturity", numeric: false, only: "Fixed Income" },
  { key: "subtype", label: "Type", numeric: false, only: "Alternatives" },
  { key: "shares", label: "Shares", numeric: true },
  { key: "costBasisPerShare", label: "Cost / Sh", numeric: true },
  { key: "currentPrice", label: "Price", numeric: true },
  { key: "marketValue", label: "Mkt Value", numeric: true },
  { key: "gainLoss", label: "Gain/Loss $", numeric: true },
  { key: "gainLossPct", label: "Gain/Loss %", numeric: true },
  { key: "weight", label: "Weight", numeric: true },
  // Last column: where the company is based (individual stocks only; funds have none).
  { key: "country", label: "Country", numeric: false, only: "Equities" },
];

export function HoldingsTable({
  positions,
  portfolioTotal,
  assetClass,
  onEdit,
  onRemove,
}: {
  positions: Position[];
  /** Whole-portfolio value (cash included); row weights are measured against it. */
  portfolioTotal: number;
  assetClass: HoldingClass;
  onEdit: (p: Position) => void;
  onRemove: (p: Position) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "marketValue", dir: "desc" });
  const rows = sortPositions(positions, sort.key, sort.dir);
  const columns = COLUMNS.filter((c) => !c.only || c.only === assetClass);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "ticker" || key === "name" || key === "sector" || key === "subtype" || key === "country" ? "asc" : "desc" },
    );

  return (
    <Table className="text-[12px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => {
            const active = sort.key === c.key;
            const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <TableHead
                key={c.label}
                className={cn("h-8 px-2", c.numeric && "text-right")}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn(
                    "label-caps inline-flex items-center gap-1 hover:text-foreground",
                    active && "text-primary",
                  )}
                >
                  {c.label}
                  <Icon className={cn("size-3", !active && "opacity-40")} />
                </button>
              </TableHead>
            );
          })}
          <TableHead className="h-8 w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const gl = gainLoss(p);
          return (
            <TableRow key={p.id}>
              <TableCell className="px-2 py-1.5 font-medium text-primary">{p.ticker}</TableCell>
              <TableCell className="max-w-[16rem] truncate px-2 py-1.5">{p.name}</TableCell>
              {assetClass === "Equities" && (
                <TableCell className="px-2 py-1.5 text-muted-foreground">{p.sector ?? "—"}</TableCell>
              )}
              {assetClass !== "Equities" && (
                <TableCell className="px-2 py-1.5 text-muted-foreground">{p.subtype ?? "—"}</TableCell>
              )}
              <TableCell className="px-2 py-1.5"><Num className="block">{formatShares(p.shares)}</Num></TableCell>
              <TableCell className="px-2 py-1.5"><Num className="block">{formatPrice(p.costBasisPerShare)}</Num></TableCell>
              <TableCell className="px-2 py-1.5">
                <div className="flex items-baseline justify-end gap-1.5">
                  {p.noLivePrice && (
                    <span className="text-[10px] text-muted-foreground" title="No live price available, using the price you entered">
                      manual
                    </span>
                  )}
                  <Num>{formatPrice(p.currentPrice)}</Num>
                </div>
              </TableCell>
              <TableCell className="px-2 py-1.5"><Num className="block">{formatCurrency(marketValue(p))}</Num></TableCell>
              <TableCell className="px-2 py-1.5">
                <Num value={gl} tone="auto" className="block">{formatSignedCurrency(gl)}</Num>
              </TableCell>
              <TableCell className="px-2 py-1.5">
                <Num value={gl} tone="auto" className="block">{formatSignedPercent(gainLossPct(p))}</Num>
              </TableCell>
              <TableCell className="px-2 py-1.5">
                <Num className="block">{formatPercent(weight(marketValue(p), portfolioTotal), 1)}</Num>
              </TableCell>
              {assetClass === "Equities" && (
                <TableCell className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{p.country ? countryName(p.country) : "—"}</TableCell>
              )}
              <TableCell className="px-1 py-1">
                <div className="flex justify-end gap-0.5">
                  <Button variant="ghost" size="icon-xs" aria-label={`Edit ${p.ticker}`} onClick={() => onEdit(p)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remove ${p.ticker}`} onClick={() => onRemove(p)}>
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
