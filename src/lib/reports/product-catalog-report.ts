/**
 * Column definitions + row-building for the Product Catalog Print / PDF / CSV export.
 *
 * This is the single place that decides which columns a role may see — both the print view
 * (/print/products) and the CSV route (/api/admin/products/export) call the functions here,
 * so a permission fix here can never drift between the two output formats. Never add a
 * cost/profit column without gating it here; the caller passes the role, not a raw boolean,
 * so the gate always matches the same canViewBuyingCost/canViewCostData rules the UI uses.
 *
 * Print and CSV need different shapes for the same data (print renders an actual thumbnail
 * and a colored status badge; CSV needs a plain Image URL cell and plain text) — so
 * buildProductCatalogRowData() computes every value exactly once (single source of truth for
 * the numbers and the permission gate), and buildProductCatalogCsvRow() /
 * buildProductCatalogPrintRow() are thin, format-only adapters over that same data.
 */
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { calcEstimatedMargin, formatInr } from "@/lib/utils/cost-conversion";
import type { StaffRole } from "@/types/database";
import type { ProductListItem } from "@/types/app";
import type { CsvCell } from "@/lib/utils/csv";
import type { ReportCell, ReportColumn, ReportRow, StockTier } from "@/components/print/report-template";

const TEXT_COLUMNS = ["Product code / SKU", "Product name", "Category", "Stock status summary", "Website status", "Selling price BHD"];

/** Owner/manager/inventory_staff/accountant (canViewBuyingCost) — buying cost, not profit. */
const COST_COLUMNS = ["Total buying value India INR", "Final stock cost Bahrain BHD"];

/** Owner/manager/accountant only (canViewCostData) — profit/margin, a stricter gate than
 *  the buying-cost columns above (inventory_staff enters cost but never sees profit). */
const PROFIT_COLUMNS = ["Estimated selling value BHD", "Estimated gross profit BHD", "Estimated margin %"];

// Print/PDF layout — same labels as the CSV columns above (no abbreviation needed at this
// column count), just with alignment/wrap rules so BHD/INR/% values stay on one line. The
// product name is the only column allowed to wrap.
const PRINT_TEXT_COLUMNS: ReportColumn[] = [
  { label: "Product code / SKU" },
  { label: "Product name", nowrap: false },
  { label: "Category" },
  { label: "Stock status summary" },
  { label: "Website status" },
  { label: "Selling price BHD", align: "right" },
];

const PRINT_COST_COLUMNS: ReportColumn[] = [
  { label: "Total buying value India INR", align: "right" },
  { label: "Final stock cost Bahrain BHD", align: "right" },
];

const PRINT_PROFIT_COLUMNS: ReportColumn[] = [
  { label: "Estimated selling value BHD", align: "right" },
  { label: "Estimated gross profit BHD", align: "right" },
  { label: "Estimated margin %", align: "right" },
];

export function productStockTier(
  item: Pick<ProductListItem, "out_of_stock_count" | "low_stock_count">,
): Exclude<StockTier, "invalid"> {
  if (item.out_of_stock_count > 0) return "out_of_stock";
  if (item.low_stock_count > 0) return "low_stock";
  return "in_stock";
}

export function productStockStatusLabel(item: Pick<ProductListItem, "out_of_stock_count" | "low_stock_count">): string {
  const tier = productStockTier(item);
  if (tier === "out_of_stock") return "Out of stock";
  if (tier === "low_stock") return "Low stock";
  return "In stock";
}

type ProductCatalogRowData = {
  imageUrl: string | null;
  sku: string;
  name: string;
  category: string;
  stockTier: Exclude<StockTier, "invalid">;
  stockStatusLabel: string;
  websiteStatus: string;
  sellingPriceBhd: string;
  /** null when the viewing role isn't permitted to see buying cost. */
  cost: { totalBuyingValueInr: string; totalFinalCostBhd: string } | null;
  /** null when the viewing role isn't permitted to see profit/margin. */
  profit: { sellingValueBhd: string; grossProfitBhd: string; marginPercent: string } | null;
};

function buildProductCatalogRowData(
  item: ProductListItem,
  role: StaffRole | null | undefined,
): ProductCatalogRowData {
  const data: ProductCatalogRowData = {
    imageUrl: item.primary_image_url,
    sku: item.sku,
    name: item.name,
    category: item.category_name ?? "Uncategorized",
    stockTier: productStockTier(item),
    stockStatusLabel: productStockStatusLabel(item),
    websiteStatus: titleize(item.online_status),
    sellingPriceBhd: item.min_selling_price === null ? "—" : formatBhd(item.min_selling_price),
    cost: null,
    profit: null,
  };

  if (canViewBuyingCost(role)) {
    data.cost = {
      totalBuyingValueInr: formatInr(item.cost_summary.totalBuyingValueInr),
      totalFinalCostBhd: formatBhd(item.cost_summary.totalFinalCostBhd),
    };
  }

  if (canViewCostData(role)) {
    const hasValidCost = item.cost_summary.validCostCount > 0;
    const estimatedGrossProfit = item.cost_summary.totalSellingValueBhd - item.cost_summary.totalFinalCostBhd;
    const estimatedMargin = hasValidCost
      ? calcEstimatedMargin(item.cost_summary.totalSellingValueBhd, item.cost_summary.totalFinalCostBhd)
      : null;
    data.profit = {
      sellingValueBhd: formatBhd(item.cost_summary.totalSellingValueBhd),
      grossProfitBhd: hasValidCost ? formatBhd(estimatedGrossProfit) : "—",
      marginPercent: estimatedMargin === null ? "—" : `${estimatedMargin.toFixed(2)}%`,
    };
  }

  return data;
}

/** Column headers for the CSV file — "Image URL" as a plain text column (no image embedding
 *  in this project's CSV output; avoids adding a heavy dependency just for this). */
export function getProductCatalogCsvColumns(role: StaffRole | null | undefined): string[] {
  const columns = ["Image URL", ...TEXT_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PROFIT_COLUMNS);
  return columns;
}

/** Column layout for the print/PDF view — "Product image" renders an actual thumbnail. */
export function getProductCatalogPrintColumns(role: StaffRole | null | undefined): ReportColumn[] {
  const columns: ReportColumn[] = [{ label: "Product image" }, ...PRINT_TEXT_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...PRINT_COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PRINT_PROFIT_COLUMNS);
  return columns;
}

/** One CSV row for `item`, containing only the cells `role` is permitted to see. */
export function buildProductCatalogCsvRow(item: ProductListItem, role: StaffRole | null | undefined): CsvCell[] {
  const data = buildProductCatalogRowData(item, role);
  const row: CsvCell[] = [
    data.imageUrl ?? "",
    data.sku,
    data.name,
    data.category,
    data.stockStatusLabel,
    data.websiteStatus,
    data.sellingPriceBhd,
  ];
  if (data.cost) row.push(data.cost.totalBuyingValueInr, data.cost.totalFinalCostBhd);
  if (data.profit) row.push(data.profit.sellingValueBhd, data.profit.grossProfitBhd, data.profit.marginPercent);
  return row;
}

/** One print-view row for `item` — an image cell, a colored stock-status badge, and a row
 *  accent tier for the light print-friendly highlight (see ReportTemplate). */
export function buildProductCatalogPrintRow(item: ProductListItem, role: StaffRole | null | undefined): ReportRow {
  const data = buildProductCatalogRowData(item, role);
  const cells: ReportCell[] = [
    { kind: "image", url: data.imageUrl, alt: data.name },
    data.sku,
    data.name,
    data.category,
    { kind: "badge", label: data.stockStatusLabel, tier: data.stockTier },
    data.websiteStatus,
    data.sellingPriceBhd,
  ];
  if (data.cost) cells.push(data.cost.totalBuyingValueInr, data.cost.totalFinalCostBhd);
  if (data.profit) cells.push(data.profit.sellingValueBhd, data.profit.grossProfitBhd, data.profit.marginPercent);
  return { cells, accentTier: data.stockTier };
}
