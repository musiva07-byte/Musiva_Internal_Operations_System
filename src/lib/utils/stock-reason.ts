import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";

/**
 * Staff-facing receive-stock reasons.
 * These are shown in the UI; they map internally to stock movement types.
 */
export const RECEIVE_STOCK_REASONS = {
  supplierDelivery: "supplier_delivery",
  openingStock: "opening_stock",
  customerReturn: "customer_return",
  other: "other",
} as const;

export type ReceiveStockReason =
  (typeof RECEIVE_STOCK_REASONS)[keyof typeof RECEIVE_STOCK_REASONS];

export const RECEIVE_STOCK_REASON_LABELS: Record<ReceiveStockReason, string> = {
  supplier_delivery: "New supplier delivery",
  opening_stock: "Opening stock",
  customer_return: "Customer return",
  other: "Other",
};

/** Valid movement types for the stock-entry form (a subset of all StockMovementType values). */
export type ReceiveStockMovementType =
  | "opening_stock"
  | "purchase_stock"
  | "return_added"
  | "cancelled_order_restore";

export function reasonToMovementType(reason: ReceiveStockReason): ReceiveStockMovementType {
  switch (reason) {
    case RECEIVE_STOCK_REASONS.supplierDelivery:
      return STOCK_MOVEMENT_TYPES.purchaseStock;
    case RECEIVE_STOCK_REASONS.openingStock:
      return STOCK_MOVEMENT_TYPES.openingStock;
    case RECEIVE_STOCK_REASONS.customerReturn:
      return STOCK_MOVEMENT_TYPES.returnAdded;
    case RECEIVE_STOCK_REASONS.other:
    default:
      return STOCK_MOVEMENT_TYPES.openingStock;
  }
}

/**
 * Staff-facing correction reasons for the Edit Product "Correct quantity" action.
 * stockAdjustmentSchema only carries a single free-text `note` (min 3 chars, required) — there
 * is no separate reason column on stock_movements to extend, so the chosen reason label is
 * folded into that note text (e.g. "Stock count correction: recounted after stocktake") rather
 * than changing the adjustment schema/RPC. Kept distinct from RECEIVE_STOCK_REASONS since a
 * correction can move stock up or down, unlike a receive action which only ever adds.
 */
export const STOCK_CORRECTION_REASONS = {
  stockCount: "stock_count",
  damaged: "damaged",
  lostOrStolen: "lost_or_stolen",
  dataEntryError: "data_entry_error",
  other: "other",
} as const;

export type StockCorrectionReason =
  (typeof STOCK_CORRECTION_REASONS)[keyof typeof STOCK_CORRECTION_REASONS];

export const STOCK_CORRECTION_REASON_LABELS: Record<StockCorrectionReason, string> = {
  stock_count: "Stock count correction",
  damaged: "Damaged / unsellable",
  lost_or_stolen: "Lost or stolen",
  data_entry_error: "Data entry error",
  other: "Other",
};

/** Combines the staff-picked reason with their optional free-text note into the single
 *  string stockAdjustmentSchema's `note` field accepts — the reason label always satisfies
 *  the 3-character minimum even when no additional note is typed. */
export function buildCorrectionNote(reason: StockCorrectionReason, note: string): string {
  const trimmedNote = note.trim();
  const reasonLabel = STOCK_CORRECTION_REASON_LABELS[reason];
  return trimmedNote ? `${reasonLabel}: ${trimmedNote}` : reasonLabel;
}
