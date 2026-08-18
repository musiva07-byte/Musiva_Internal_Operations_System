/**
 * Column definitions + row-building for the Stock Management Print / PDF / CSV export.
 *
 * Same contract as product-catalog-report.ts: both /print/inventory and
 * /api/admin/inventory/export call these same functions, so the permission gate can never
 * drift between the print view and the CSV file. getValidBuyingCost() stays the one
 * calculation authority for buying cost — never read latest_landed_cost_bhd /
 * average_landed_cost_bhd directly (see cost-conversion.ts's doc comment on why).
 */
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { getStockStatus } from "@/lib/pricing/calculations";
import {
  calcEstimatedMargin,
  calcEstimatedProfit,
  formatInr,
  getBuyingCostStatus,
  getValidBuyingCost,
} from "@/lib/utils/cost-conversion";
import type { StaffRole } from "@/types/database";
import type { InventoryVariantItem } from "@/types/app";
import type { CsvCell } from "@/lib/utils/csv";

const BASE_COLUMNS = [
  "Product name",
  "Product code / SKU",
  "Color",
  "Size",
  "Variant code",
  "Available stock",
  "Minimum stock",
  "Stock status",
  "Selling price BHD",
];

const BUYING_COST_COLUMNS = [
  "Buying price India INR",
  "Exchange rate",
  "Buy Bahrain per piece BHD",
  "Import cost per piece BHD",
  "Final cost per piece BHD",
  "Total final cost BHD",
  "Cost status",
];

const PROFIT_COLUMNS = ["Profit per piece BHD", "Margin %"];

const BUYING_COST_STATUS_LABEL: Record<"recorded" | "missing" | "invalid", string> = {
  recorded: "Recorded",
  missing: "Not recorded",
  invalid: "Invalid cost",
};

export function getStockManagementColumns(role: StaffRole | null | undefined): string[] {
  const columns = [...BASE_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...BUYING_COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PROFIT_COLUMNS);
  return columns;
}

/** One export row for `variant`, containing only the cells `role` is permitted to see —
 *  always the same length/order as getStockManagementColumns(role) for that same role. */
export function buildStockManagementRow(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): CsvCell[] {
  const sellingPriceBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);

  const row: CsvCell[] = [
    variant.product_name,
    variant.product_sku,
    variant.color,
    variant.size,
    variant.variant_sku,
    variant.stock_quantity,
    variant.minimum_stock,
    titleize(getStockStatus(variant.stock_quantity, variant.minimum_stock)),
    formatBhd(sellingPriceBhd),
  ];

  if (canViewBuyingCost(role)) {
    const cost = getValidBuyingCost(variant);
    const status = getBuyingCostStatus(variant);
    row.push(
      cost ? formatInr(cost.buyingPriceInr) : "—",
      cost ? cost.exchangeRateToBhd.toFixed(6) : "—",
      cost ? formatBhd(cost.convertedUnitCostBhd) : "—",
      cost ? formatBhd(cost.importCostBhd) : "—",
      cost ? formatBhd(cost.finalUnitCostBhd) : "—",
      cost ? formatBhd(cost.finalUnitCostBhd * variant.stock_quantity) : "—",
      BUYING_COST_STATUS_LABEL[status],
    );
  }

  if (canViewCostData(role)) {
    const cost = getValidBuyingCost(variant);
    const profit = cost ? calcEstimatedProfit(sellingPriceBhd, cost.finalUnitCostBhd) : null;
    const margin = cost ? calcEstimatedMargin(sellingPriceBhd, cost.finalUnitCostBhd) : null;
    row.push(
      profit === null ? "—" : formatBhd(profit),
      margin === null ? "—" : `${margin.toFixed(2)}%`,
    );
  }

  return row;
}
