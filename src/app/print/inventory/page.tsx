import type { Metadata } from "next";
import { AutoPrint } from "@/components/print/auto-print";
import { ReportPrintToolbar } from "@/components/print/report-print-toolbar";
import { ReportTemplate, type ReportFilterSummary } from "@/components/print/report-template";
import { listInventoryVariantsForExport } from "@/lib/services/inventory.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import {
  getStockManagementPrintColumns,
  buildStockManagementPrintRow,
} from "@/lib/reports/stock-management-report";

export const metadata: Metadata = {
  title: "Stock Management Report",
};

type PrintInventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const STOCK_LABELS: Record<string, string> = {
  low: "Low stock",
  out: "Out of stock",
};

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  archived: "Archived products",
  all: "All products",
};

/**
 * Page-scoped print setup for this report only. globals.css gives every printed document an
 * unnamed `@page { size: A4 portrait }` default and opts this report into A3 landscape through
 * a NAMED page (`page: report-landscape-a3`). A browser that doesn't apply named pages would
 * fall back to A4 portrait — so this unnamed rule, rendered later in the document than
 * globals.css (and so winning the cascade), sets A3 landscape for this route as well. It
 * lives in the page rather than globals.css so it is removed from the document when staff
 * navigate away and can never leak into invoice or label printing.
 *
 * This is only a preference: Safari prints on the paper chosen in its print dialog, which is
 * why the report layout itself is fluid (see globals.css, .print-a3-landscape) and fits any
 * paper rather than relying on this rule.
 */
const STOCK_REPORT_PAGE_CSS = `@media print { @page { size: A3 landscape; margin: 10mm; } }`;

function PrintSetupHint() {
  return (
    <>
      <p className="font-medium text-musiva-ink">Recommended: A3 • Landscape • Fit to page</p>
      <p className="mt-0.5">
        Only A4 paper available? Choose Landscape and a smaller scale (or Fit to page) — all 14
        columns still print, just smaller. A3 landscape is recommended for readability.
      </p>
      <p className="mt-0.5">
        Safari: in the Print dialog, click Show Details and turn off &ldquo;Print headers and
        footers&rdquo; to remove the page title, web address and date Safari adds.
      </p>
    </>
  );
}

export default async function PrintInventoryPage({ searchParams }: PrintInventoryPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const stock = getParam(params, "stock") ?? "all";
  const productStatus = getParam(params, "productStatus") ?? "active";

  const [{ profile }, exportResult] = await Promise.all([
    getCurrentAuthState(),
    listInventoryVariantsForExport({ q, stock, productStatus }),
  ]);

  const role = profile?.role ?? null;
  const backHref = (() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (stock !== "all") next.set("stock", stock);
    if (productStatus !== "active") next.set("productStatus", productStatus);
    const qs = next.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  })();

  const filters: ReportFilterSummary[] = [];
  if (q) filters.push({ label: "Search", value: q });
  if (stock !== "all" && STOCK_LABELS[stock]) filters.push({ label: "Stock level", value: STOCK_LABELS[stock] });
  if (productStatus !== "active" && PRODUCT_STATUS_LABELS[productStatus]) {
    filters.push({ label: "Products", value: PRODUCT_STATUS_LABELS[productStatus] });
  }

  const columns = getStockManagementPrintColumns(role);
  const rows = exportResult.rows.map((variant) => buildStockManagementPrintRow(variant, role));

  return (
    <main className="report-print-root min-h-screen bg-musiva-ivory py-6">
      <style>{STOCK_REPORT_PAGE_CSS}</style>
      <ReportPrintToolbar backHref={backHref} hint={<PrintSetupHint />} />
      <AutoPrint enabled={!exportResult.error} />
      {exportResult.error ? (
        <section className="print-page print-sheet">
          <p className="text-center text-sm text-destructive">{exportResult.error}</p>
        </section>
      ) : (
        <div className="print-preview-scroll">
          <ReportTemplate
            columns={columns}
            compact
            emptyMessage="No stock records match the current filters."
            filters={filters}
            generatedAt={new Date()}
            pageSize="a3-landscape"
            rowCountPlacement="header"
            rows={rows}
            title="Stock Management Report"
            truncatedNotice={
              exportResult.truncated
                ? "This report only includes the first 3,000 matching stock records. Narrow your filters to see the rest."
                : null
            }
          />
        </div>
      )}
    </main>
  );
}
