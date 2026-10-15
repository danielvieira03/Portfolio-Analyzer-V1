// Turn raw file contents into a clean table: find the delimiter, find the header row.
// Pure functions (no file or browser APIs) so they are easy to test.

import { matchColumns } from "./columns";
import type { RawRow } from "./normalize";

export type Cell = string | number | boolean | Date | null | undefined;

/** Pick the most likely delimiter by counting candidates in the first lines. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 10);
  let best = ",";
  let bestScore = 0;
  for (const d of [",", ";", "\t", "|"]) {
    // Count delimiters outside quotes on each line; reward consistency across lines.
    const counts = lines.map((l) => {
      let inQ = false;
      let n = 0;
      for (const ch of l) {
        if (ch === '"') inQ = !inQ;
        else if (ch === d && !inQ) n++;
      }
      return n;
    });
    const min = Math.min(...counts, Infinity);
    const score = counts.length ? (min === Infinity ? 0 : min) : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Minimal RFC-4180 style parser: quotes, escaped quotes, newlines inside quotes. */
export function parseDelimited(text: string, delimiter = sniffDelimiter(text)): string[][] {
  const src = text.replace(/^﻿/, ""); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const isBlank = (c: Cell) => c === null || c === undefined || String(c).trim() === "";

export interface Table {
  headers: string[];
  rows: RawRow[];
  /** 1-based file row where the headers were found. */
  headerRow: number;
}

/**
 * Turn a grid of cells into headers + row objects. The header row is the one among the
 * first 10 non-empty rows that matches the most known column names (so title lines
 * above the real headers are skipped).
 */
export function matrixToTable(matrix: Cell[][]): Table {
  const nonEmpty = matrix
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((r) => r.cells.some((c) => !isBlank(c)));
  if (nonEmpty.length === 0) return { headers: [], rows: [], headerRow: 1 };

  let best = nonEmpty[0];
  let bestScore = -1;
  for (const r of nonEmpty.slice(0, 10)) {
    const labels = r.cells.map((c) => String(c ?? "").trim()).filter(Boolean);
    const score = Object.keys(matchColumns(labels).columns).length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }

  // Unique, non-empty header names ("Col 4" for unnamed columns that have data).
  const seen = new Map<string, number>();
  const headers = best.cells.map((c, i) => {
    const base = String(c ?? "").trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const rows = nonEmpty
    .filter((r) => r.line > best.line)
    .map((r) => {
      const obj: RawRow = {};
      headers.forEach((h, i) => { obj[h] = r.cells[i] ?? ""; });
      return obj;
    });
  return { headers, rows, headerRow: best.line };
}
