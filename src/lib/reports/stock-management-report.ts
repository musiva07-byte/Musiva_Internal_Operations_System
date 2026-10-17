/**
 * Column definitions + row-building for the Stock Management Print / PDF / CSV export.
 *
 * Same contract as product-catalog-report.ts: both /print/inventory and
 * /api/admin/inventory/export call the functions here, so the permission gate can never
 * drift between the print view and the CSV file. getValidBuyingCost() stays the one
 * calculation authority for buying cost — never read latest_landed_cost_bhd /
 * average_landed_cost_bhd directly (see cost-conversion.ts's doc comment on why).
 *
 * Print and CSV need different shapes for the same data (print renders an actual thumbnail
 * and a colored status badge; CSV needs a plain Image URL cell and plain text) — so
 * buildStockManagementRowData() computes every value exactly once (single source of truth
 * for the numbers and the permission gate), and buildStockManagementCsvRow() /
 * buildStockManagementPrintRow() are thin, format-only adapters over that same data.
 */
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import {
  calcEstimatedMargin,
  calcEstimatedProfit,
  formatInr,
  getValidBuyingCost,
} from "@/lib/utils/cost-conversion";
import type { StaffRole } from "@/types/database";
import type { InventoryVariantItem } from "@/types/app";
import type { CsvCell } from "@/lib/utils/csv";
import type { ReportCell, ReportColumn, ReportRow, StockTier } from "@/components/print/report-template";

// CSV headers — plain full-length strings (a spreadsheet has no width constraint, so no
// column is ever removed or abbreviated here).
const TEXT_COLUMNS = ["Product code / SKU", "Product name", "Color", "Size", "Stock status", "Selling price BHD"];

const COST_COLUMNS = [
  "Buying price India INR",
  "Exchange rate",
  "Buy Bahrain per piece BHD",
  "Import cost per piece BHD",
  "Final cost per piece BHD",
  "Total final cost BHD",
];

const PROFIT_COLUMNS = ["Profit per piece BHD", "Margin %"];

// Print/PDF headers — every column above is kept, only the printed label is shortened (with
// the full name preserved via `fullLabel` as a hover tooltip) so all 15 columns fit cleanly
// on one A3 landscape page. Width/align/nowrap are sized so BHD/INR/% values never wrap onto
// a second line — the product name is the only column allowed to wrap. Column ORDER here
// deliberately differs from the CSV (CSV order/labels are untouched — see
// getStockManagementCsvColumns) to put Exchange Rate last and group all cost/profit figures
// together, per the print-layout spec.
// Widths below total ~1134px of the ~1450px usable on an A3-landscape page (420mm minus
// margins/padding) — deliberately leaving headroom rather than packing to the edge, so the
// larger print font (see .report-compact in globals.css) and Color/Product's extra room both
// fit without reintroducing overflow. Removing the verbose Stock badge and moving Rate out of
// the cost block (both used to force everything else narrower) is what freed this room.
const PRINT_TEXT_COLUMNS: ReportColumn[] = [
  { label: "Code / SKU", fullLabel: "Product code / SKU", width: "90px" },
  { label: "Product", fullLabel: "Product name", width: "160px", nowrap: false },
  // Wide enough for "MUSTARD YELLOW" / "DUSTY PURPLE" / "BOTTLE GREEN" without ever running
  // into the Size column.
  { label: "Color", width: "112px" },
  // A separate fixed column (never shares space with Color) wide enough for "FREE SIZE".
  { label: "Size", width: "76px" },
  { label: "Stock", fullLabel: "Stock status", align: "right", width: "42px" },
  { label: "Sell (BHD)", fullLabel: "Selling price BHD", align: "right", width: "60px" },
];

// Cost columns, in the required print order: Buy (INR) → Buy (BHD) → Import (BHD) →
// Landed (BHD) → Total Cost (BHD). Exchange Rate is intentionally NOT here — it's appended
// as its own column after profit/margin (see PRINT_RATE_COLUMN) so it prints last.
const PRINT_COST_COLUMNS: ReportColumn[] = [
  { label: "Buy (INR)", fullLabel: "Buying price India INR", align: "right", width: "74px" },
  { label: "Buy (BHD)", fullLabel: "Buy Bahrain per piece BHD", align: "right", width: "58px" },
  { label: "Import (BHD)", fullLabel: "Import cost per piece BHD", align: "right", width: "62px" },
  { label: "Landed (BHD)", fullLabel: "Final cost per piece BHD", align: "right", width: "62px" },
  { label: "Total Cost (BHD)", fullLabel: "Total final cost BHD", align: "right", width: "68px" },
];

const PRINT_PROFIT_COLUMNS: ReportColumn[] = [
  { label: "Profit (BHD)", fullLabel: "Profit per piece BHD", align: "right", width: "58px" },
  { label: "Margin (%)", fullLabel: "Margin %", align: "right", width: "58px" },
];

// Exchange rate — last column in print (moved out of the middle of the cost block per the
// layout spec). Shown as a bare number ("0.003900"), not the verbose "1 INR = BHD ..." string
// CSV uses — the column header already identifies what it is, so repeating that text in every
// cell would only waste width. CSV's own "Exchange rate" column/value is untouched.
const PRINT_RATE_COLUMN: ReportColumn = {
  label: "Rate",
  fullLabel: "Exchange rate (1 INR in BHD)",
  align: "right",
  width: "70px",
};

/** Fixed report-display thresholds — deliberately independent of the variant's own
 *  minimum_stock (used everywhere else in the app, e.g. getStockStatus()). This is a
 *  print/export-only summarization rule, not a change to inventory business logic. */
export function stockTierForQuantity(quantity: number): StockTier {
  if (quantity < 0) return "invalid";
  if (quantity === 0) return "out_of_stock";
  if (quantity <= 2) return "low_stock";
  return "in_stock";
}

const TIER_LABEL: Record<StockTier, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  invalid: "Invalid stock",
};

/** "3 units — In Stock" / "2 units — Low Stock" / "0 units — Out of Stock" / "Invalid stock". */
export function stockStatusLabel(quantity: number): string {
  const tier = stockTierForQuantity(quantity);
  if (tier === "invalid") return TIER_LABEL.invalid;
  return `${quantity} unit${quantity === 1 ? "" : "s"} — ${TIER_LABEL[tier]}`;
}

type StockManagementRowData = {
  imageUrl: string | null;
  productSku: string;
  productName: string;
  color: string;
  size: string;
  stockTier: StockTier;
  stockStatusLabel: string;
  sellingPriceBhd: string;
  /** null when the viewing role isn't permitted to see buying cost. */
  cost: {
    buyingInr: string;
    /** CSV's verbose form — "1 INR = BHD 0.004520". Print uses exchangeRatePlain instead. */
    exchangeRate: string;
    /** Print-only — just the bare rate ("0.003900"), since the print column header already
     *  says "Rate" and repeating "1 INR = BHD" in every cell would waste width. */
    exchangeRatePlain: string;
    buyBahrain: string;
    importCost: string;
    finalCost: string;
    totalFinalCost: string;
  } | null;
  /** null when the viewing role isn't permitted to see profit/margin. */
  profit: { profitPerPiece: string; margin: string } | null;
};

function buildStockManagementRowData(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): StockManagementRowData {
  const sellingPriceBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);

  const data: StockManagementRowData = {
    imageUrl: variant.primary_image_url,
    productSku: variant.product_sku,
    productName: variant.product_name,
    color: variant.color,
    size: variant.size,
    stockTier: stockTierForQuantity(variant.stock_quantity),
    stockStatusLabel: stockStatusLabel(variant.stock_quantity),
    sellingPriceBhd: formatBhd(sellingPriceBhd),
    cost: null,
    profit: null,
  };

  if (canViewBuyingCost(role)) {
    const cost = getValidBuyingCost(variant);
    data.cost = {
      buyingInr: cost ? formatInr(cost.buyingPriceInr) : "—",
      // Same multiply-direction convention shown elsewhere in the app (e.g. the Edit Product
      // bulk-apply panel): exchangeRateToBhd = 1 INR expressed in BHD.
      exchangeRate: cost ? `1 INR = BHD ${cost.exchangeRateToBhd.toFixed(6)}` : "—",
      exchangeRatePlain: cost ? cost.exchangeRateToBhd.toFixed(6) : "—",
      buyBahrain: cost ? formatBhd(cost.convertedUnitCostBhd) : "—",
      importCost: cost ? formatBhd(cost.importCostBhd) : "—",
      finalCost: cost ? formatBhd(cost.finalUnitCostBhd) : "—",
      totalFinalCost: cost ? formatBhd(cost.finalUnitCostBhd * variant.stock_quantity) : "—",
    };
  }

  if (canViewCostData(role)) {
    const cost = getValidBuyingCost(variant);
    const profit = cost ? calcEstimatedProfit(sellingPriceBhd, cost.finalUnitCostBhd) : null;
    const margin = cost ? calcEstimatedMargin(sellingPriceBhd, cost.finalUnitCostBhd) : null;
    data.profit = {
      profitPerPiece: profit === null ? "—" : formatBhd(profit),
      margin: margin === null ? "—" : `${margin.toFixed(2)}%`,
    };
  }

  return data;
}

/** Column headers for the CSV file — "Image URL" as a plain text column (no image embedding
 *  in this project's CSV output; see product-catalog-report.ts for the same convention). */
export function getStockManagementCsvColumns(role: StaffRole | null | undefined): string[] {
  const columns = ["Image URL", ...TEXT_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PROFIT_COLUMNS);
  return columns;
}

/** Column layout for the print/PDF view — "Image" (Product image) renders an actual
 *  thumbnail. Every column the CSV exposes is kept here too; only the printed label is
 *  shortened to fit, and the order differs from the CSV so Exchange Rate prints last (see
 *  PRINT_TEXT_COLUMNS/PRINT_COST_COLUMNS/PRINT_PROFIT_COLUMNS/PRINT_RATE_COLUMN). */
export function getStockManagementPrintColumns(role: StaffRole | null | undefined): ReportColumn[] {
  const columns: ReportColumn[] = [
    { label: "Image", fullLabel: "Product image", width: "42px" },
    ...PRINT_TEXT_COLUMNS,
  ];
  if (canViewBuyingCost(role)) columns.push(...PRINT_COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PRINT_PROFIT_COLUMNS);
  // Rate is gated by the same canViewBuyingCost check as the other cost columns — it just
  // prints in a different position (last) than the CSV's "Exchange rate" column.
  if (canViewBuyingCost(role)) columns.push(PRINT_RATE_COLUMN);
  return columns;
}

/** One CSV row for `variant`, containing only the cells `role` is permitted to see. */
export function buildStockManagementCsvRow(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): CsvCell[] {
  const data = buildStockManagementRowData(variant, role);
  const row: CsvCell[] = [
    data.imageUrl ?? "",
    data.productSku,
    data.productName,
    data.color,
    data.size,
    data.stockStatusLabel,
    data.sellingPriceBhd,
  ];
  if (data.cost) {
    row.push(data.cost.buyingInr, data.cost.exchangeRate, data.cost.buyBahrain, data.cost.importCost, data.cost.finalCost, data.cost.totalFinalCost);
  }
  if (data.profit) {
    row.push(data.profit.profitPerPiece, data.profit.margin);
  }
  return row;
}

/** One print-view row for `variant` — an image cell, a bare colored stock NUMBER (no
 *  "units"/"Low Stock" text or pill — see ReportStockNumberCell), and a row accent tier for
 *  the light print-friendly highlight (see ReportTemplate). Cost/profit/rate cells are pushed
 *  in the print-specific column order (Buy → Buy BHD → Import → Landed → Total Cost → Profit
 *  → Margin → Rate last) — see getStockManagementPrintColumns for the matching column list. */
export function buildStockManagementPrintRow(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): ReportRow {
  const data = buildStockManagementRowData(variant, role);
  const cells: ReportCell[] = [
    { kind: "image", url: data.imageUrl, alt: `${data.productName} — ${data.color}` },
    data.productSku,
    data.productName,
    data.color,
    data.size,
    { kind: "stock-number", quantity: variant.stock_quantity, tier: data.stockTier },
    data.sellingPriceBhd,
  ];
  if (data.cost) {
    cells.push(data.cost.buyingInr, data.cost.buyBahrain, data.cost.importCost, data.cost.finalCost, data.cost.totalFinalCost);
  }
  if (data.profit) {
    cells.push(data.profit.profitPerPiece, data.profit.margin);
  }
  if (data.cost) {
    cells.push(data.cost.exchangeRatePlain);
  }
  return { cells, accentTier: data.stockTier };
}
