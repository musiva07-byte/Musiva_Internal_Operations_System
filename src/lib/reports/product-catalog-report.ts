/**
 * Column definitions + row-building for the Product Catalog Print / PDF / CSV export.
 *
 * This is the single place that decides which columns a role may see — both the print view
 * (/print/products) and the CSV route (/api/admin/products/export) call these same functions,
 * so a permission fix here can never drift between the two output formats. Never add a
 * cost/profit column without gating it here; the caller passes the role, not a raw boolean,
 * so the gate always matches the same canViewBuyingCost/canViewCostData rules the UI uses.
 */
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { calcEstimatedMargin, formatInr, getCostSummaryBadge } from "@/lib/utils/cost-conversion";
import type { StaffRole } from "@/types/database";
import type { ProductListItem } from "@/types/app";
import type { CsvCell } from "@/lib/utils/csv";

const BASE_COLUMNS = [
  "Product name",
  "Product code / SKU",
  "Category",
  "Options count",
  "Total stock",
  "Stock status",
  "Product status",
  "Website status",
  "From price BHD",
];

const BUYING_COST_COLUMNS = [
  "Cost status",
  "Variants with buying cost",
  "Variants missing buying cost",
  "Total buying value India INR",
  "Final stock cost Bahrain BHD",
];

const PROFIT_COLUMNS = ["Estimated selling value BHD", "Estimated gross profit BHD", "Estimated margin %"];

export function productStockStatusLabel(item: Pick<ProductListItem, "out_of_stock_count" | "low_stock_count">): string {
  if (item.out_of_stock_count > 0) return "Out of stock";
  if (item.low_stock_count > 0) return "Low stock";
  return "In stock";
}

/** Column headers this role is allowed to see, in export order. */
export function getProductCatalogColumns(role: StaffRole | null | undefined): string[] {
  const columns = [...BASE_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...BUYING_COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PROFIT_COLUMNS);
  return columns;
}

/** One export row for `item`, containing only the cells `role` is permitted to see — always
 *  the same length/order as getProductCatalogColumns(role) for that same role. */
export function buildProductCatalogRow(item: ProductListItem, role: StaffRole | null | undefined): CsvCell[] {
  const row: CsvCell[] = [
    item.name,
    item.sku,
    item.category_name ?? "Uncategorized",
    item.variant_count,
    item.total_stock,
    productStockStatusLabel(item),
    titleize(item.status),
    titleize(item.online_status),
    item.min_selling_price === null ? "—" : formatBhd(item.min_selling_price),
  ];

  if (canViewBuyingCost(role)) {
    const costBadge = getCostSummaryBadge(item.cost_summary.validCostCount, item.cost_summary.missingCostCount);
    row.push(
      costBadge.label,
      item.cost_summary.validCostCount,
      item.cost_summary.missingCostCount,
      formatInr(item.cost_summary.totalBuyingValueInr),
      formatBhd(item.cost_summary.totalFinalCostBhd),
    );
  }

  if (canViewCostData(role)) {
    const hasValidCost = item.cost_summary.validCostCount > 0;
    const estimatedGrossProfit = item.cost_summary.totalSellingValueBhd - item.cost_summary.totalFinalCostBhd;
    const estimatedMargin = hasValidCost
      ? calcEstimatedMargin(item.cost_summary.totalSellingValueBhd, item.cost_summary.totalFinalCostBhd)
      : null;
    row.push(
      formatBhd(item.cost_summary.totalSellingValueBhd),
      hasValidCost ? formatBhd(estimatedGrossProfit) : "—",
      estimatedMargin === null ? "—" : `${estimatedMargin.toFixed(2)}%`,
    );
  }

  return row;
}
