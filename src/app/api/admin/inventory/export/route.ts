import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthState } from "@/lib/auth/session";
import { listInventoryVariantsForExport } from "@/lib/services/inventory.service";
import { getStockManagementCsvColumns, buildStockManagementCsvRow } from "@/lib/reports/stock-management-report";
import { buildCsv, csvFilename } from "@/lib/utils/csv";

const FRIENDLY_ERROR = "Could not export the report. Please try again or contact the administrator.";

/**
 * Stock Management "Download CSV" — mirrors the page's current filters (q/stock/
 * productStatus) via query params, and gates columns by role the same way /print/inventory
 * does (both ultimately call buildStockManagementRowData — one source of truth).
 * Requires only a signed-in staff profile, matching the Stock Management page itself.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { profile } = await getCurrentAuthState();
  if (!profile) {
    return NextResponse.json({ error: "You must be signed in to export this report." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const stock = url.searchParams.get("stock") ?? "all";
  const productStatus = url.searchParams.get("productStatus") ?? "active";

  try {
    const result = await listInventoryVariantsForExport({ q, stock, productStatus });
    if (result.error) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const columns = getStockManagementCsvColumns(profile.role);
    const rows = result.rows.map((variant) => buildStockManagementCsvRow(variant, profile.role));
    const csv = buildCsv(columns, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("stock-management")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export] Stock Management CSV export failed:", err);
    return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
  }
}
