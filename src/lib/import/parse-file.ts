// Read a CSV / Excel file in the browser into raw rows (SheetJS).

import type { RawRow } from "./normalize";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export async function readSpreadsheet(file: File): Promise<{ rows: RawRow[]; headers: string[] }> {
  const XLSX = await import("xlsx"); // loaded only when the user imports
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("The file has no sheets");
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
  const headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []).map(String);
  return { rows, headers };
}
