import { BrandMark } from "@/components/print/brand-mark";
import { formatDateTime } from "@/lib/formatters/date";
import type { CsvCell } from "@/lib/utils/csv";

export type ReportFilterSummary = {
  label: string;
  value: string;
};

type ReportTemplateProps = {
  /** "Product Catalog Report" / "Stock Management Report" — the exact required titles. */
  title: string;
  generatedAt: Date;
  /** Only the filters actually applied (non-default) — omit the rest entirely. */
  filters: ReportFilterSummary[];
  columns: string[];
  rows: CsvCell[][];
  /** Shown when the export hit its safety row cap — the report is not the complete set. */
  truncatedNotice?: string | null;
  emptyMessage: string;
};

/** Shared A4 print layout for report exports (Product Catalog, Stock Management) — reuses
 *  the same .print-page/.print-sheet/.print-header/.print-table classes as the invoice and
 *  label templates so every printed document in the system looks like one family. */
export function ReportTemplate({
  title,
  generatedAt,
  filters,
  columns,
  rows,
  truncatedNotice,
  emptyMessage,
}: ReportTemplateProps) {
  return (
    <section className="print-page print-sheet">
      <header className="print-header">
        <BrandMark />
        <div className="text-right">
          <p className="text-xl font-semibold text-musiva-mauve">{title}</p>
          <p className="mt-0.5 text-xs text-musiva-muted">Generated {formatDateTime(generatedAt)}</p>
        </div>
      </header>

      {filters.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-musiva-muted">
          <span className="font-semibold uppercase tracking-wide text-musiva-mauve">Filters applied</span>
          {filters.map((f) => (
            <span key={f.label}>
              {f.label}: <strong className="text-musiva-ink">{f.value}</strong>
            </span>
          ))}
        </div>
      )}

      {truncatedNotice && (
        <p className="mt-3 rounded border border-musiva-warning/40 bg-musiva-warning/10 px-2 py-1.5 text-xs text-musiva-warning-foreground">
          {truncatedNotice}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-musiva-muted">{emptyMessage}</p>
      ) : (
        <table className="print-table mt-5">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-5 border-t border-musiva-border pt-3 text-center text-xs text-musiva-muted">
        {rows.length} row{rows.length !== 1 ? "s" : ""} · Moosiva Internal Operations System
      </footer>
    </section>
  );
}
