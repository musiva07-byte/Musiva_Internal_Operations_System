/**
 * Column definitions + row-building for the Stock Management Print / PDF / CSV export.
 *
 * Same contract as product-catalog-report.ts: both /print/inventory and
 * /api/admin/inventory/export call the functions here, so the permission gate can never
 * drift between the print view and the CSV file. getValidBuyingCost() stays the one
 * calculation authority for buying cost — never read latest_landed_cost_bhd /
 * average_landed_cost_bhd directly (see cost-conversion.ts's doc comment on why).
 *
 * buildStockManagementRowData() computes every figure exactly once, as raw numbers, and
 * applies the permission gate. buildStockManagementCsvRow() and buildStockManagementPrintRow()
 * only FORMAT those same numbers — CSV with full labels ("BHD 11.000", "1 INR = BHD ..."),
 * print compactly ("11.000", "0.004520") because the print column headers already name the
 * currency. Neither adapter calculates anything, so the two outputs can never disagree.
 */
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd, formatBhdAmount } from "@/lib/formatters/currency";
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

// ── Print/PDF columns ─────────────────────────────────────────────────────────
// Widths are relative WEIGHTS, converted to percentages of the printable width per role (see
// withPercentWidths). Fixed px/mm widths were the root of the Safari printing failure: Safari
// prints on whatever paper and margins the staff member picks in its print dialog, so a table
// sized for one exact page width gets its right-hand columns (Rate, Margin…) cut off on any
// narrower printable area. Percentages always resolve to 100% of the real page.
//
// Text columns (Code, Product, Color, Size) are allowed to wrap so a long value can never run
// into its neighbour. Numeric columns never wrap (a number split over two lines is unreadable)
// and are never clipped or ellipsized — their widths are sized from measured content instead.
//
// WEIGHTS ARE PIXELS ON THE A3 BASIS: A3 landscape is 420mm; minus 2 × 10mm @page margins
// leaves 400mm = 1512 CSS px of printable width, and the full 14-column weights below sum to
// exactly 1512. Each numeric column is its widest measured value at the 14px print font, or
// its widest header word (headers wrap to two lines), plus a little headroom — Rate gets ~20%
// over "0.003900" so it can never be clipped. Product takes the space the numbers don't need,
// so long names fit on one line, keeping rows short and pages full. The percentages then apply
// to whatever paper is actually chosen (Safari prints on the paper picked in its dialog).
//
// There is deliberately no product-image column in print (client decision): images added row
// height and a loading dependency without helping a stock count on paper. The CSV export keeps
// its "Image URL" column unchanged.
type WeightedColumn = Omit<ReportColumn, "width"> & { weight: number };

const PRINT_TEXT_COLUMNS: WeightedColumn[] = [
  { label: "Code / SKU", fullLabel: "Product code / SKU", nowrap: false, weight: 88 },
  { label: "Product", fullLabel: "Product name", nowrap: false, weight: 514 },
  // Comfortably wider than "MUSTARD YELLOW" / "DUSTY PURPLE" / "BOTTLE GREEN", so color names
  // stay on one line and well clear of Size; still wraps inside its own cell if ever needed.
  { label: "Color", nowrap: false, weight: 160 },
  // Always its own cell — "FREE SIZE", "XXL", "3XL", numeric sizes.
  { label: "Size", nowrap: false, weight: 74 },
  { label: "Stock", fullLabel: "Stock status", align: "right", weight: 54 },
  { label: "Sell (BHD)", fullLabel: "Selling price BHD", align: "right", weight: 62 },
];

// Cost columns in the required print order: Buy (INR) → Buy (BHD) → Import (BHD) →
// Landed (BHD) → Total Cost (BHD). Exchange Rate is NOT here — it prints last, after
// profit/margin (see PRINT_RATE_COLUMN).
const PRINT_COST_COLUMNS: WeightedColumn[] = [
  { label: "Buy (INR)", fullLabel: "Buying price India INR", align: "right", weight: 80 },
  { label: "Buy (BHD)", fullLabel: "Buy Bahrain per piece BHD", align: "right", weight: 60 },
  { label: "Import (BHD)", fullLabel: "Import cost per piece BHD", align: "right", weight: 62 },
  { label: "Landed (BHD)", fullLabel: "Final cost per piece BHD", align: "right", weight: 64 },
  { label: "Total Cost (BHD)", fullLabel: "Total final cost BHD", align: "right", weight: 84 },
];

const PRINT_PROFIT_COLUMNS: WeightedColumn[] = [
  { label: "Profit (BHD)", fullLabel: "Profit per piece BHD", align: "right", weight: 62 },
  { label: "Margin (%)", fullLabel: "Margin %", align: "right", weight: 70 },
];

// Shown as a bare number with all six decimals ("0.003900") — the header already says what it
// is. CSV keeps its own verbose "1 INR = BHD 0.003900" form, untouched.
const PRINT_RATE_COLUMN: WeightedColumn = {
  label: "Rate",
  fullLabel: "Exchange rate (1 INR in BHD)",
  align: "right",
  weight: 78,
};

/** A3 landscape printable width in CSS px: (420mm − 2 × 10mm margins) = 400mm at 96 px/inch.
 *  The full 14-column weight set sums to exactly this. */
export const A3_PRINTABLE_WIDTH_PX = 1512;

/** Normalizes weights so the visible columns always total exactly 100% of the printable
 *  width — for the full 15-column owner view and for roles that see fewer columns alike. */
function withPercentWidths(columns: WeightedColumn[]): ReportColumn[] {
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  return columns.map(({ weight, ...column }) => ({
    ...column,
    width: `${((weight / totalWeight) * 100).toFixed(3)}%`,
  }));
}

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

/** "3 units — In Stock" / "2 units — Low Stock" / "0 units — Out of Stock" / "Invalid stock".
 *  Used by the CSV export; the print report shows only the bare number. */
export function stockStatusLabel(quantity: number): string {
  const tier = stockTierForQuantity(quantity);
  if (tier === "invalid") return TIER_LABEL.invalid;
  return `${quantity} unit${quantity === 1 ? "" : "s"} — ${TIER_LABEL[tier]}`;
}

type CostFigures = {
  buyingPriceInr: number;
  /** 1 INR expressed in BHD (multiply direction), as recorded on the variant. */
  exchangeRateToBhd: number;
  convertedUnitCostBhd: number;
  importCostBhd: number;
  finalUnitCostBhd: number;
  totalFinalCostBhd: number;
};

type StockManagementRowData = {
  imageUrl: string | null;
  productSku: string;
  productName: string;
  color: string;
  size: string;
  stockQuantity: number;
  stockTier: StockTier;
  sellingPriceBhd: number;
  /** false → the role may not see buying cost: no cost cells are emitted at all. */
  showCost: boolean;
  /** null when cost is visible but not recorded for this variant → every cost cell is "—". */
  cost: CostFigures | null;
  /** false → the role may not see profit/margin: no profit cells are emitted at all. */
  showProfit: boolean;
  profitPerPieceBhd: number | null;
  /** null when cost is missing or the selling price is 0 (margin is undefined). */
  marginPercent: number | null;
};

function buildStockManagementRowData(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): StockManagementRowData {
  const sellingPriceBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);
  const showCost = canViewBuyingCost(role);
  const showProfit = canViewCostData(role);
  // Only computed when some cost-derived column is visible — unauthorized roles never even
  // have the figures in memory for this row.
  const validCost = showCost || showProfit ? getValidBuyingCost(variant) : null;

  return {
    imageUrl: variant.primary_image_url,
    productSku: variant.product_sku,
    productName: variant.product_name,
    color: variant.color,
    size: variant.size,
    stockQuantity: variant.stock_quantity,
    stockTier: stockTierForQuantity(variant.stock_quantity),
    sellingPriceBhd,
    showCost,
    cost:
      showCost && validCost
        ? {
            buyingPriceInr: validCost.buyingPriceInr,
            exchangeRateToBhd: validCost.exchangeRateToBhd,
            convertedUnitCostBhd: validCost.convertedUnitCostBhd,
            importCostBhd: validCost.importCostBhd,
            finalUnitCostBhd: validCost.finalUnitCostBhd,
            totalFinalCostBhd: validCost.finalUnitCostBhd * variant.stock_quantity,
          }
        : null,
    showProfit,
    profitPerPieceBhd:
      showProfit && validCost ? calcEstimatedProfit(sellingPriceBhd, validCost.finalUnitCostBhd) : null,
    marginPercent:
      showProfit && validCost ? calcEstimatedMargin(sellingPriceBhd, validCost.finalUnitCostBhd) : null,
  };
}

const MISSING = "—";

function orMissing(value: number | null | undefined, format: (value: number) => string): string {
  return value === null || value === undefined ? MISSING : format(value);
}

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

/** Column headers for the CSV file — "Image URL" as a plain text column (no image embedding
 *  in this project's CSV output; see product-catalog-report.ts for the same convention). */
export function getStockManagementCsvColumns(role: StaffRole | null | undefined): string[] {
  const columns = ["Image URL", ...TEXT_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PROFIT_COLUMNS);
  return columns;
}

/** Column layout for the print/PDF view, in the required order with Rate last. Every CSV
 *  column is kept except "Image URL" (print has no image column); only the printed label is
 *  shortened. Widths are percentages of the printable page width (see withPercentWidths). */
export function getStockManagementPrintColumns(role: StaffRole | null | undefined): ReportColumn[] {
  const columns: WeightedColumn[] = [...PRINT_TEXT_COLUMNS];
  if (canViewBuyingCost(role)) columns.push(...PRINT_COST_COLUMNS);
  if (canViewCostData(role)) columns.push(...PRINT_PROFIT_COLUMNS);
  // Same canViewBuyingCost gate as the other cost columns — it only prints in a different
  // position (last) than the CSV's "Exchange rate" column.
  if (canViewBuyingCost(role)) columns.push(PRINT_RATE_COLUMN);
  return withPercentWidths(columns);
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
    stockStatusLabel(data.stockQuantity),
    formatBhd(data.sellingPriceBhd),
  ];
  if (data.showCost) {
    const cost = data.cost;
    row.push(
      orMissing(cost?.buyingPriceInr, formatInr),
      orMissing(cost?.exchangeRateToBhd, (rate) => `1 INR = BHD ${rate.toFixed(6)}`),
      orMissing(cost?.convertedUnitCostBhd, formatBhd),
      orMissing(cost?.importCostBhd, formatBhd),
      orMissing(cost?.finalUnitCostBhd, formatBhd),
      orMissing(cost?.totalFinalCostBhd, formatBhd),
    );
  }
  if (data.showProfit) {
    row.push(orMissing(data.profitPerPieceBhd, formatBhd), orMissing(data.marginPercent, formatPercent));
  }
  return row;
}

/** One print-view row for `variant` — no image cell, a bare colored stock NUMBER (no
 *  "units"/"Low Stock" text or pill — see ReportStockNumberCell), compact numbers with no
 *  repeated "BHD" prefix, and Rate last. Cell order matches getStockManagementPrintColumns. */
export function buildStockManagementPrintRow(
  variant: InventoryVariantItem,
  role: StaffRole | null | undefined,
): ReportRow {
  const data = buildStockManagementRowData(variant, role);
  const cells: ReportCell[] = [
    data.productSku,
    data.productName,
    data.color,
    data.size,
    { kind: "stock-number", quantity: data.stockQuantity, tier: data.stockTier },
    formatBhdAmount(data.sellingPriceBhd),
  ];
  const cost = data.cost;
  if (data.showCost) {
    cells.push(
      orMissing(cost?.buyingPriceInr, formatInr),
      orMissing(cost?.convertedUnitCostBhd, formatBhdAmount),
      orMissing(cost?.importCostBhd, formatBhdAmount),
      orMissing(cost?.finalUnitCostBhd, formatBhdAmount),
      orMissing(cost?.totalFinalCostBhd, formatBhdAmount),
    );
  }
  if (data.showProfit) {
    cells.push(orMissing(data.profitPerPieceBhd, formatBhdAmount), orMissing(data.marginPercent, formatPercent));
  }
  if (data.showCost) {
    cells.push(orMissing(cost?.exchangeRateToBhd, (rate) => rate.toFixed(6)));
  }
  return { cells, accentTier: data.stockTier };
}
