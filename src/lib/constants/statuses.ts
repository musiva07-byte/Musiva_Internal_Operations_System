export const ORDER_STATUSES = {
  new: "new",
  confirmed: "confirmed",
  inFulfilment: "in_fulfilment",
  completed: "completed",
  cancelled: "cancelled",
  returned: "returned",
  exchangeRequested: "exchange_requested",
  // Legacy values — kept for existing data compatibility
  packed: "packed",
  readyForPickup: "ready_for_pickup",
  outForDelivery: "out_for_delivery",
  delivered: "delivered",
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
  draft: "draft",
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
  returnedToStore: "returned_to_store",
  cancelled: "cancelled",
  // Legacy value — kept for existing data compatibility
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
  inTransit: "in_transit",
  partiallyReceived: "partially_received",
  received: "received",
  cancelled: "cancelled",
} as const;

export const PRICING_STATUSES = {
  regular: "regular",
  discountScheduled: "discount_scheduled",
  onSale: "on_sale",
  discountEnded: "discount_ended",
} as const;

export const STOCK_STATUSES = {
  inStock: "in_stock",
  lowStock: "low_stock",
  outOfStock: "out_of_stock",
} as const;

export const PURCHASE_PAYMENT_STATUSES = {
  unpaid: "unpaid",
  partial: "partial",
  paid: "paid",
} as const;

/**
 * Controlled delivery state machine.
 * The Postgres function advance_delivery_status() enforces these
 * transitions server-side; this mirrors them for client-side display.
 */
export const DELIVERY_NEXT_STATUSES: Record<string, string[]> = {
  pending:          ["packed", "cancelled"],
  packed:           ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["with_courier", "out_for_delivery", "cancelled"],
  with_courier:     ["out_for_delivery", "failed", "returned_to_store", "cancelled"],
  out_for_delivery: ["delivered", "failed", "returned_to_store"],
  delivered:        [],
  failed:           ["with_courier", "returned_to_store", "cancelled"],
  returned_to_store: [],
  cancelled:        [],
  returned:         [],   // legacy terminal
};

/**
 * Controlled order state machine — simplified.
 *
 * DELIVERY orders:  new → in_fulfilment (via confirmOrderHandoff which creates the delivery)
 * WALK-IN orders:   new → confirmed → completed
 *
 * Fulfilment stages (packed / ready_for_pickup / out_for_delivery / delivered)
 * are no longer manually driven from the Orders side. They belong to Deliveries.
 * Legacy values are listed here only so existing rows don't break validation.
 */
export const ORDER_NEXT_STATUSES: Record<string, string[]> = {
  new:               ["confirmed", "in_fulfilment"],  // confirmed=walk-in, in_fulfilment=delivery
  confirmed:         ["completed"],                    // walk-in: direct completion
  in_fulfilment:     [],                               // managed exclusively by delivery service
  completed:         [],
  cancelled:         [],
  returned:          [],
  exchange_requested: [],
  // Legacy — kept so old rows are handled gracefully but no new transitions exposed
  packed:            [],
  ready_for_pickup:  [],
  out_for_delivery:  [],
  delivered:         [],
};

/** Statuses that require a written reason before transitioning. */
export const ORDER_STATUSES_REQUIRING_REASON: string[] = ["cancelled"];

/** Statuses where order is still actively being worked on. */
export const ORDER_ACTIVE_STATUSES = new Set([
  "new",
  "confirmed",
  "in_fulfilment",
  // Legacy values treated as active
  "packed",
  "ready_for_pickup",
  "out_for_delivery",
]);

/** Statuses that count as "completed" for tab/reporting purposes. */
export const ORDER_COMPLETED_STATUSES = new Set([
  "completed",
  "delivered",  // legacy
  "returned",
]);

export const DELIVERY_STATUSES_REQUIRING_REASON: string[] = [
  "failed",
  "returned_to_store",
  "returned",  // legacy
];

export const FULFILMENT_METHODS = {
  walkIn: "walk_in",
  customerPickup: "customer_pickup",
  delivery: "delivery",
} as const;

export const FULFILMENT_METHOD_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  customer_pickup: "Customer Pickup",
  delivery: "Delivery",
};

export const WEBSITE_REQUEST_STATUSES = {
  new: "new",
  contacted: "contacted",
  confirmed: "confirmed",
  cancelled: "cancelled",
} as const;

export const WEBSITE_REQUEST_PAYMENT_PREFERENCES = {
  cashOnDelivery: "cash_on_delivery",
  benefitpay: "benefitpay",
  bankTransfer: "bank_transfer",
  paymentLink: "payment_link",
} as const;

/** Matches the customer-facing labels in the moosiva-website project's own
 *  lib/constants/bahrain.ts PAYMENT_PREFERENCE_LABELS — kept identical so staff see the
 *  same brand-consistent wording the customer chose at checkout. */
export const WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  benefitpay: "BenefitPay",
  bank_transfer: "Bank Transfer",
  payment_link: "Payment Link",
};

/**
 * Website order request state machine (base transitions — role-gating happens in
 * lib/services/website-request.service.ts via canDecideWebsiteRequest). "new" can go
 * straight to "confirmed"/"cancelled" as well as "contacted", matching Unit 2F's spec.
 * "cancelled" is terminal for everyone except an owner reopening it back to "new".
 */
export const WEBSITE_REQUEST_NEXT_STATUSES: Record<string, string[]> = {
  new: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: ["new"],
};

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
