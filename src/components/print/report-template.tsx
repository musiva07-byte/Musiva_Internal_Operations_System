import { BrandMark } from "@/components/print/brand-mark";
import { formatDateTime } from "@/lib/formatters/date";
import type { CsvCell } from "@/lib/utils/csv";

export type ReportFilterSummary = {
  label: string;
  value: string;
};

/** Shared stock-highlight tiers for both reports' print view — a light, print-friendly badge
 *  + row accent border (see the "Row highlight colors" rule: full-row fills waste printer ink,
 *  so only the status badge and a thin left border carry the color). "invalid" only applies to
 *  Stock Management (a single variant can have a negative quantity); Product Catalog rows
 *  never use it (an aggregate count can't be negative). */
export type StockTier = "in_stock" | "low_stock" | "out_of_stock" | "invalid";

export type ReportImageCell = { kind: "image"; url: string | null; alt: string };
export type ReportBadgeCell = { kind: "badge"; label: string; tier: StockTier };
export type ReportCell = CsvCell | ReportImageCell | ReportBadgeCell;

export type ReportRow = {
  cells: ReportCell[];
  /** Drives the row's left accent border — omit for no accent. */
  accentTier?: StockTier;
};

/** Print-column layout metadata — kept separate from each row's cell values so width/
 *  alignment/wrap rules live once per column instead of being repeated on every row. Only the
 *  print view uses this; CSV headers stay plain strings (a spreadsheet doesn't need fixed
 *  widths or wrap control). */
export type ReportColumn = {
  /** The label actually printed — may be a shortened/compact form so a wide table still fits. */
  label: string;
  /** Full label shown via the header's title attribute (hover tooltip) when label is abbreviated. */
  fullLabel?: string;
  align?: "left" | "right";
  /** Default true (most report columns are short codes/currency that must never wrap or split
   *  across lines). Set false only for the one column meant to wrap — the product name. */
  nowrap?: boolean;
  /** Fixed column width (e.g. "80px"). Once any column sets a width the table switches to
   *  table-layout: fixed so the widths are actually honored. */
  width?: string;
};

function isImageCell(cell: ReportCell): cell is ReportImageCell {
  return typeof cell === "object" && cell !== null && "kind" in cell && cell.kind === "image";
}

function isBadgeCell(cell: ReportCell): cell is ReportBadgeCell {
  return typeof cell === "object" && cell !== null && "kind" in cell && cell.kind === "badge";
}

function ReportCellContent({ cell }: { cell: ReportCell }) {
  if (isImageCell(cell)) {
    return (
      <span className="report-thumb">
        {cell.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- print output, not a Next <Image> route
          <img alt={cell.alt} className="report-thumb-img" src={cell.url} />
        ) : (
          <span className="report-thumb-placeholder" aria-hidden />
        )}
      </span>
    );
  }

  if (isBadgeCell(cell)) {
    return <span className={`report-badge report-badge--${cell.tier}`}>{cell.label}</span>;
  }

  return <>{cell ?? "—"}</>;
}

type ReportTemplateProps = {
  /** "Product Catalog Report" / "Stock Management Report" — the exact required titles. */
  title: string;
  generatedAt: Date;
  /** Only the filters actually applied (non-default) — omit the rest entirely. */
  filters: ReportFilterSummary[];
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Shown when the export hit its safety row cap — the report is not the complete set. */
  truncatedNotice?: string | null;
  emptyMessage: string;
  /** Omit for portrait A4 (this template is only used by the two wide list reports, not the
   *  invoice/label templates, so every caller here picks a landscape size). "a3-landscape"
   *  gives a many-column report (Stock Management's full cost/profit breakdown) enough width
   *  to keep every column readable without removing any of them. */
  pageSize?: "a4-landscape" | "a3-landscape";
  /** Smaller font/padding/thumbnail for reports with many columns — keeps a wide table
   *  readable without cutting any column. */
  compact?: boolean;
};

/** Shared A4/A3 print layout for report exports (Product Catalog, Stock Management) — reuses
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
  pageSize,
  compact = false,
}: ReportTemplateProps) {
  const pageSizeClass =
    pageSize === "a3-landscape" ? "print-a3-landscape" : pageSize === "a4-landscape" ? "print-landscape" : "";
  const sectionClassName = ["print-page", "print-sheet", pageSizeClass, compact ? "report-compact" : ""]
    .filter(Boolean)
    .join(" ");
  const hasFixedWidths = columns.some((column) => column.width);

  return (
    <section className={sectionClassName}>
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
        <table className="print-table mt-5" style={hasFixedWidths ? { tableLayout: "fixed" } : undefined}>
          {hasFixedWidths && (
            <colgroup>
              {columns.map((column) => (
                <col key={column.label} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.label} title={column.fullLabel} style={{ textAlign: column.align ?? "left" }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={row.accentTier ? `report-row-accent report-row-accent--${row.accentTier}` : undefined}
              >
                {row.cells.map((cell, cellIndex) => {
                  const column = columns[cellIndex];
                  const nowrap = column?.nowrap ?? true;
                  return (
                    <td
                      key={cellIndex}
                      style={{ textAlign: column?.align ?? "left", whiteSpace: nowrap ? "nowrap" : "normal" }}
                    >
                      <ReportCellContent cell={cell} />
                    </td>
                  );
                })}
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
