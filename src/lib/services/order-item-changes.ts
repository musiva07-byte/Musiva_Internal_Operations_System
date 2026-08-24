/**
 * Pure diffing/calculation logic for editing an existing order's items (Order Edit "change
 * variant/size/color/quantity" workflow). Kept dependency-free from Supabase so the core
 * business rules — what changed, and exactly how much stock moves for each variant — can be
 * unit tested directly, and so updateOrderItems() (order.service.ts) never has to duplicate
 * this reasoning inline.
 *
 * Stock delta sign convention: positive = stock returned to that variant (old/removed/reduced
 * quantity), negative = stock deducted from that variant (new/added/increased quantity). This
 * mirrors the add_variant_stock / deduct_variant_stock RPC split in order.service.ts.
 */

export type ExistingOrderItemLite = {
  id: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type IncomingOrderItem = {
  /** Present for an item being kept or changed; absent/null for a brand-new line. */
  id?: string | null;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type OrderItemDiff = {
  removed: ExistingOrderItemLite[];
  added: IncomingOrderItem[];
  changed: Array<{ old: ExistingOrderItemLite; new: IncomingOrderItem }>;
  unchanged: ExistingOrderItemLite[];
};

/**
 * Compares the order's current items against the staff-submitted item list. Any incoming item
 * whose `id` doesn't match a real existing item is treated as a new line (added) — callers
 * should pre-sanitize incoming ids against the real order before calling this, so a
 * fabricated/foreign id can never be treated as "changed" against the wrong row.
 */
export function diffOrderItems(
  existing: ExistingOrderItemLite[],
  incoming: IncomingOrderItem[],
): OrderItemDiff {
  const existingById = new Map(existing.map((item) => [item.id, item]));

  const removed: ExistingOrderItemLite[] = [];
  const changed: OrderItemDiff["changed"] = [];
  const unchanged: ExistingOrderItemLite[] = [];
  const added: IncomingOrderItem[] = [];
  const keptIds = new Set<string>();

  for (const item of incoming) {
    const old = item.id ? existingById.get(item.id) : undefined;
    if (!old) {
      added.push(item);
      continue;
    }
    keptIds.add(old.id);
    const isSame =
      old.productVariantId === item.productVariantId &&
      old.quantity === item.quantity &&
      old.unitPrice === item.unitPrice &&
      old.discount === item.discount;
    if (isSame) {
      unchanged.push(old);
    } else {
      changed.push({ old, new: item });
    }
  }

  for (const item of existing) {
    if (!keptIds.has(item.id)) removed.push(item);
  }

  return { removed, added, changed, unchanged };
}

/** Net stock delta per variant implied by an OrderItemDiff. Variants that net to zero (e.g. a
 *  variant swapped away and back within the same edit) are omitted entirely. */
export function computeStockDeltas(diff: OrderItemDiff): Map<string, number> {
  const deltas = new Map<string, number>();
  const bump = (variantId: string, amount: number) => {
    if (amount === 0) return;
    deltas.set(variantId, (deltas.get(variantId) ?? 0) + amount);
  };

  for (const item of diff.removed) bump(item.productVariantId, item.quantity);
  for (const item of diff.added) bump(item.productVariantId, -item.quantity);
  for (const { old, new: next } of diff.changed) {
    if (old.productVariantId === next.productVariantId) {
      bump(old.productVariantId, old.quantity - next.quantity);
    } else {
      bump(old.productVariantId, old.quantity);
      bump(next.productVariantId, -next.quantity);
    }
  }

  for (const [variantId, delta] of deltas) {
    if (delta === 0) deltas.delete(variantId);
  }

  return deltas;
}

/** Same subtotal/discount/grand-total formula createOrder() uses, so an edited order's totals
 *  are always computed the same way a newly created order's totals are. */
export function calculateOrderTotals(
  items: Array<{ quantity: number; unitPrice: number; discount: number }>,
  deliveryCharge: number,
): { subtotal: number; discountTotal: number; grandTotal: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + deliveryCharge);
  return { subtotal, discountTotal, grandTotal };
}
