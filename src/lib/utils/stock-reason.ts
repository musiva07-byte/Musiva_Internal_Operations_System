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
