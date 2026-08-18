import type { Metadata } from "next";
import { AutoPrint } from "@/components/print/auto-print";
import { ReportPrintToolbar } from "@/components/print/report-print-toolbar";
import { ReportTemplate, type ReportFilterSummary } from "@/components/print/report-template";
import { listInventoryVariantsForExport } from "@/lib/services/inventory.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { getStockManagementColumns, buildStockManagementRow } from "@/lib/reports/stock-management-report";

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

  const columns = getStockManagementColumns(role);
  const rows = exportResult.rows.map((variant) => buildStockManagementRow(variant, role));

  return (
    <main className="min-h-screen bg-musiva-ivory py-6">
      <ReportPrintToolbar backHref={backHref} />
      <AutoPrint enabled={!exportResult.error} />
      {exportResult.error ? (
        <section className="print-page print-sheet">
          <p className="text-center text-sm text-destructive">{exportResult.error}</p>
        </section>
      ) : (
        <ReportTemplate
          columns={columns}
          emptyMessage="No stock records match the current filters."
          filters={filters}
          generatedAt={new Date()}
          rows={rows}
          title="Stock Management Report"
          truncatedNotice={
            exportResult.truncated
              ? "This report only includes the first 3,000 matching stock records. Narrow your filters to see the rest."
              : null
          }
        />
      )}
    </main>
  );
}
