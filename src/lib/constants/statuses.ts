export const ORDER_STATUSES = {
  new: "new",
  confirmed: "confirmed",
  packed: "packed",
  readyForPickup: "ready_for_pickup",
  outForDelivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  returned: "returned",
  exchangeRequested: "exchange_requested",
} as const;

export const ORDER_SOURCES = {
  instagram: "instagram",
  whatsapp: "whatsapp",
  website: "website",
  walkIn: "walk_in",
  tiktok: "tiktok",
  referral: "referral",
  other: "other",
} as const;

export const INVENTORY_STATUSES = {
  inStock: "in_stock",
  lowStock: "low_stock",
  outOfStock: "out_of_stock",
  discontinued: "discontinued",
} as const;

export const PRODUCT_STATUSES = {
  active: "active",
  inactive: "inactive",
  archived: "archived",
} as const;

export const PRODUCT_VARIANT_STATUSES = PRODUCT_STATUSES;

export const STOCK_MOVEMENT_TYPES = {
  openingStock: "opening_stock",
  purchaseStock: "purchase_stock",
  saleDeduction: "sale_deduction",
  returnAdded: "return_added",
  exchangeDeduction: "exchange_deduction",
  damaged: "damaged",
  manualAdjustment: "manual_adjustment",
  cancelledOrderRestore: "cancelled_order_restore",
} as const;

export const DELIVERY_STATUSES = {
  pending: "pending",
  packed: "packed",
  readyForPickup: "ready_for_pickup",
  withCourier: "with_courier",
  outForDelivery: "out_for_delivery",
  delivered: "delivered",
  failed: "failed",
  returned: "returned",
} as const;

export const PAYMENT_STATUSES = {
  unpaid: "unpaid",
  paid: "paid",
  partial: "partial",
  cod: "cod",
  refunded: "refunded",
} as const;

export const RETURN_TYPES = {
  return: "return",
  exchange: "exchange",
} as const;

export const RETURN_REASONS = {
  sizeIssue: "size_issue",
  colorIssue: "color_issue",
  damagedItem: "damaged_item",
  wrongItemSent: "wrong_item_sent",
  customerChangedMind: "customer_changed_mind",
  deliveryFailed: "delivery_failed",
  other: "other",
} as const;

export const RETURN_CONDITIONS = {
  sellable: "sellable",
  damaged: "damaged",
  needsReview: "needs_review",
} as const;

export const RETURN_STATUSES = {
  pending: "pending",
  approved: "approved",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export const RETURN_ITEM_ACTIONS = {
  addBackToStock: "add_back_to_stock",
  markDamaged: "mark_damaged",
  exchange: "exchange",
  refundOnly: "refund_only",
  noStockChange: "no_stock_change",
} as const;

export const PURCHASE_STATUSES = {
  draft: "draft",
  ordered: "ordered",
  partiallyReceived: "partially_received",
  received: "received",
  cancelled: "cancelled",
} as const;

export const PURCHASE_PAYMENT_STATUSES = {
  unpaid: "unpaid",
  partial: "partial",
  paid: "paid",
} as const;

export const EXPENSE_CATEGORIES = {
  productPurchase: "product_purchase",
  packaging: "packaging",
  delivery: "delivery",
  marketing: "marketing",
  rent: "rent",
  staffSalary: "staff_salary",
  utilities: "utilities",
  software: "software",
  miscellaneous: "miscellaneous",
} as const;
