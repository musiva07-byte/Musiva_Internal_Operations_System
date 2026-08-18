import type { Metadata } from "next";
import { AutoPrint } from "@/components/print/auto-print";
import { ReportPrintToolbar } from "@/components/print/report-print-toolbar";
import { ReportTemplate, type ReportFilterSummary } from "@/components/print/report-template";
import { listCategories, listProductsForExport } from "@/lib/services/product.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { getProductCatalogColumns, buildProductCatalogRow } from "@/lib/reports/product-catalog-report";
import type { WebsiteFilterValue } from "@/lib/validations/product-publishing";

export const metadata: Metadata = {
  title: "Product Catalog Report",
};

type PrintProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active only",
  inactive: "Inactive only",
  archived: "Archived",
  all: "All statuses",
};

const WEBSITE_LABELS: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  hidden: "Hidden",
  missing_details: "Missing details",
};

function toWebsiteFilterValue(value: string): WebsiteFilterValue {
  return value in WEBSITE_LABELS ? (value as WebsiteFilterValue) : "";
}

export default async function PrintProductsPage({ searchParams }: PrintProductsPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const status = getParam(params, "status") ?? "";
  const categoryId = getParam(params, "categoryId") ?? "all";
  const website = getParam(params, "website") ?? "";

  const [categories, { profile }, exportResult] = await Promise.all([
    listCategories(),
    getCurrentAuthState(),
    listProductsForExport({ q, status, categoryId, websiteFilter: toWebsiteFilterValue(website) }),
  ]);

  const role = profile?.role ?? null;
  const backHref = (() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (categoryId !== "all") next.set("categoryId", categoryId);
    if (website) next.set("website", website);
    const qs = next.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  })();

  const filters: ReportFilterSummary[] = [];
  if (q) filters.push({ label: "Search", value: q });
  if (status && STATUS_LABELS[status]) filters.push({ label: "Status", value: STATUS_LABELS[status] });
  if (categoryId !== "all") {
    const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "Unknown category";
    filters.push({ label: "Category", value: categoryName });
  }
  if (website && WEBSITE_LABELS[website]) filters.push({ label: "Website", value: WEBSITE_LABELS[website] });

  const columns = getProductCatalogColumns(role);
  const rows = exportResult.rows.map((item) => buildProductCatalogRow(item, role));

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
          emptyMessage="No products match the current filters."
          filters={filters}
          generatedAt={new Date()}
          rows={rows}
          title="Product Catalog Report"
          truncatedNotice={
            exportResult.truncated
              ? "This report only includes the first 2,000 matching products. Narrow your filters to see the rest."
              : null
          }
        />
      )}
    </main>
  );
}
