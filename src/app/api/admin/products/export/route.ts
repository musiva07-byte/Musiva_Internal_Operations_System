import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthState } from "@/lib/auth/session";
import { listProductsForExport } from "@/lib/services/product.service";
import { getProductCatalogColumns, buildProductCatalogRow } from "@/lib/reports/product-catalog-report";
import { buildCsv, csvFilename } from "@/lib/utils/csv";
import type { WebsiteFilterValue } from "@/lib/validations/product-publishing";

const FRIENDLY_ERROR = "Could not export the report. Please try again or contact the administrator.";
const VALID_WEBSITE_FILTERS = new Set(["published", "draft", "hidden", "missing_details", ""]);

/**
 * Product Catalog "Download CSV" — mirrors the page's current filters (q/status/categoryId/
 * website) via query params, and gates columns by role the same way /print/products does
 * (both call getProductCatalogColumns/buildProductCatalogRow — one source of truth for what
 * each role may see). Requires only a signed-in staff profile, matching the Product Catalog
 * page itself (viewing it is not restricted beyond authentication; cost/profit columns are
 * gated separately below that).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { profile } = await getCurrentAuthState();
  if (!profile) {
    return NextResponse.json({ error: "You must be signed in to export this report." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const categoryId = url.searchParams.get("categoryId") ?? "all";
  const websiteParam = url.searchParams.get("website") ?? "";
  const websiteFilter: WebsiteFilterValue = VALID_WEBSITE_FILTERS.has(websiteParam)
    ? (websiteParam as WebsiteFilterValue)
    : "";

  try {
    const result = await listProductsForExport({ q, status, categoryId, websiteFilter });
    if (result.error) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const columns = getProductCatalogColumns(profile.role);
    const rows = result.rows.map((item) => buildProductCatalogRow(item, profile.role));
    const csv = buildCsv(columns, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("product-catalog")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export] Product Catalog CSV export failed:", err);
    return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
  }
}
