"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_LABELS, IMPORT_FIELDS, missingRequired, type ColumnMap, type ImportField } from "@/lib/import/columns";

const NONE = "__none";

/** "Map your columns": pick which column in the file holds each piece of information. */
export function ColumnMapper({
  headers,
  map,
  onChange,
  onContinue,
  onBack,
}: {
  headers: string[];
  map: ColumnMap;
  onChange: (map: ColumnMap) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const missing = missingRequired(map.columns);
  const items = { [NONE]: "— not in my file —", ...Object.fromEntries(headers.map((h) => [h, h])) };

  const set = (field: ImportField, header: string | null) => {
    const columns = { ...map.columns };
    if (!header || header === NONE) delete columns[field];
    else columns[field] = header;
    // A column the user picked by hand is taken at its word: no per-share/total guessing.
    onChange({ columns, costAmbiguous: field === "cost" ? false : map.costAmbiguous });
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        I couldn’t match every column automatically. Tell me which column in your file holds each item.
        The file’s columns are: <span className="text-foreground">{headers.join(", ")}</span>.
      </p>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <div key={field} className="flex items-center justify-between gap-3">
            <span className="text-[12px]">{FIELD_LABELS[field]}</span>
            <Select value={map.columns[field] ?? NONE} onValueChange={(v) => set(field, v)} items={items}>
              <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— not in my file —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {missing.length > 0 ? (
        <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-[12px] text-primary">
          Still needed: {missing.join("; ")}.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Looks good — continue to preview the rows before anything is saved.</p>
      )}
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>Choose a different file</Button>
        <Button disabled={missing.length > 0} onClick={onContinue}>Preview</Button>
      </div>
    </div>
  );
}
