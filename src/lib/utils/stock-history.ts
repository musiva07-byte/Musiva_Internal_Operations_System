import type { StockMovementType } from "@/types/database";

/**
 * Per-variant Total Stock / Sold / In Stock for the Stock Management print report.
 *
 * In Stock is always product_variants.stock_quantity, the one source of truth. Total Stock and
 * Sold are read from stock_movements, using each movement's real change to the balance:
 *
 *   Total Stock = opening stock + purchase receipts
 *   Sold        = sale deductions − cancellation restores − returned stock
 *
 * Movement types don't map one-to-one onto business meaning, so these rules matter:
 * - return_added also records order-edit corrections and their rollbacks. Both net against the
 *   sale they adjust, so they belong in Sold either way.
 * - Everything on a cancelled order is excluded from Sold. A cancellation can leave stock
 *   unrestored ("Return items to stock" unticked, or a failed order); those units are gone from
 *   the shelf but were never sold, so they are reported as cancelled_not_restored.
 * - Quantity corrections are neither receipts nor sales, so they stay out of both figures. Total
 *   Stock − Sold therefore won't equal In Stock for a corrected variant. That is reported, never
 *   forced.
 *
 * history_status keeps three different situations apart, and a fourth, a failed load, is the
 * caller's: getVariantStockSummaries() returns null, not a summary.
 * - "complete": the movements add up to the current balance, so both figures are verified. A
 *   variant with no stock and no movements is complete, at 0.
 * - "no_history": stock exists but no movement was ever recorded.
 * - "incomplete": movements exist but don't add up to the balance.
 * Only "complete" gives figures; otherwise both are null rather than a guess.
 */

export type StockMovementGroup = {
  variant_id: string;
  movement_type: StockMovementType;
  order_cancelled: boolean;
  balance_change: number;
};

export type StockHistoryStatus = "complete" | "no_history" | "incomplete";

export type VariantStockSummary = {
  variant_id: string;
  history_status: StockHistoryStatus;
  /** Null unless history_status is "complete". */
  total_stock_quantity: number | null;
  /** Null unless history_status is "complete". */
  net_sold_quantity: number | null;
  current_stock_quantity: number;
  /** Net change from corrections, unmatched returns, and any other non-sale movement. */
  corrections_quantity: number;
  cancelled_not_restored_quantity: number;
  /** current_stock_quantity − the sum of all movements. Non-zero means incomplete history. */
  unexplained_quantity: number;
};

export function summarizeVariantStock(
  variantId: string,
  currentStock: number,
  groups: StockMovementGroup[],
): VariantStockSummary {
  let received = 0;
  let salesOut = 0;
  let salesBack = 0;
  let cancelledNet = 0;
  let corrections = 0;

  for (const group of groups) {
    const change = group.balance_change;
    switch (group.movement_type) {
      case "opening_stock":
      case "purchase_stock":
        received += change;
        break;
      case "sale_deduction":
      case "exchange_deduction":
        if (group.order_cancelled) cancelledNet += change;
        else salesOut -= change;
        break;
      case "cancelled_order_restore":
      case "return_added":
        if (group.order_cancelled) cancelledNet += change;
        else salesBack += change;
        break;
      default:
        corrections += change;
    }
  }

  const netSold = salesOut - salesBack;
  const soldQuantity = Math.max(netSold, 0);
  const unmatchedReturns = Math.max(-netSold, 0);
  const cancelledNotRestored = Math.max(-cancelledNet, 0);
  const overRestored = Math.max(cancelledNet, 0);

  const ledgerBalance = received - salesOut + salesBack + cancelledNet + corrections;
  const unexplained = currentStock - ledgerBalance;
  const verified = unexplained === 0;

  return {
    variant_id: variantId,
    history_status: verified ? "complete" : groups.length === 0 ? "no_history" : "incomplete",
    total_stock_quantity: verified ? received : null,
    net_sold_quantity: verified ? soldQuantity : null,
    current_stock_quantity: currentStock,
    corrections_quantity: corrections + unmatchedReturns + overRestored,
    cancelled_not_restored_quantity: cancelledNotRestored,
    unexplained_quantity: unexplained,
  };
}

/** One summary per variant, including variants with no movements at all. */
export function summarizeVariantStocks(
  variants: { id: string; stock_quantity: number }[],
  groups: StockMovementGroup[],
): Map<string, VariantStockSummary> {
  const groupsByVariant = new Map<string, StockMovementGroup[]>();
  for (const group of groups) {
    const list = groupsByVariant.get(group.variant_id) ?? [];
    list.push(group);
    groupsByVariant.set(group.variant_id, list);
  }

  return new Map(
    variants.map((variant) => [
      variant.id,
      summarizeVariantStock(variant.id, variant.stock_quantity, groupsByVariant.get(variant.id) ?? []),
    ]),
  );
}
