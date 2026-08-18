/**
 * Shared CSV building helpers for report exports (Product Catalog, Stock Management).
 * Every value is quoted unconditionally (matches the existing generic export route at
 * /api/admin/export/[type]) — always valid CSV, and simpler than conditional quoting.
 */

export type CsvCell = string | number | null | undefined;

/** Escapes a single cell: wraps in quotes, doubles any internal quotes. Commas, newlines,
 *  and carriage returns are safe once quoted — no special-casing needed for those. */
function csvCell(value: CsvCell): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(values: CsvCell[]): string {
  return values.map(csvCell).join(",");
}

/** Leading UTF-8 byte-order mark so Excel renders non-ASCII characters (₹, currency symbols,
 *  etc.) correctly instead of mojibake — without it Excel assumes the system codepage. */
const UTF8_BOM = "﻿";

/** Builds a full CSV document (header row + data rows), CRLF line endings per the CSV spec. */
export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return UTF8_BOM + lines.join("\r\n");
}

/** `<prefix>-YYYY-MM-DD.csv`, per the required export filename convention. */
export function csvFilename(prefix: string, date: Date = new Date()): string {
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`;
}
