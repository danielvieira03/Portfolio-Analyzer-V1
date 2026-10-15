// Read a CSV / Excel file in the browser into a table (SheetJS for Excel only).

import { matrixToTable, parseDelimited, type Cell, type Table } from "./table";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
/** For the file picker: extensions plus the MIME types browsers attach to CSV/Excel files. */
export const ACCEPT_ATTR = [
  ...ACCEPTED_EXTENSIONS,
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // UTF-16 files (some Excel "Unicode text" exports) start with a byte-order mark.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

export async function readSpreadsheet(file: File): Promise<Table> {
  const buf = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) {
    return matrixToTable(parseDelimited(decodeText(buf)));
  }
  const XLSX = await import("xlsx"); // loaded only when the user imports an Excel file
  const book = XLSX.read(buf, { type: "array" });
  for (const name of book.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<Cell[]>(book.Sheets[name], { header: 1, defval: "" });
    const table = matrixToTable(grid);
    if (table.rows.length) return table; // first sheet that has data
  }
  return { headers: [], rows: [], headerRow: 1 };
}
