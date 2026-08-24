/**
 * Tests for the Order Edit item-diffing / stock-delta logic (order-item-changes.ts). These are
 * the core business rules behind the "change variant/size/color/quantity without creating a
 * duplicate order" workflow — see updateOrderItems() in order.service.ts, which is the only
 * caller and does no additional diffing of its own.
 */
import { describe, expect, it } from "vitest";
import {
  diffOrderItems,
  computeStockDeltas,
  calculateOrderTotals,
  type ExistingOrderItemLite,
  type IncomingOrderItem,
} from "./order-item-changes";

const WHITE_XL = "11111111-1111-4111-8111-111111111111";
const WHITE_XXL = "22222222-2222-4222-8222-222222222222";
const BLACK_M = "33333333-3333-4333-8333-333333333333";

function existingItem(overrides: Partial<ExistingOrderItemLite> = {}): ExistingOrderItemLite {
  return {
    id: "item-1",
    productVariantId: WHITE_XL,
    quantity: 1,
    unitPrice: 11,
    discount: 0,
    ...overrides,
  };
}

describe("diffOrderItems — classification", () => {
  it("classifies an untouched item as unchanged", () => {
    const existing = [existingItem()];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 }];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.unchanged).toEqual(existing);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it("classifies a missing existing item as removed", () => {
    const existing = [existingItem()];
    const diff = diffOrderItems(existing, []);
    expect(diff.removed).toEqual(existing);
  });

  it("classifies an item with no id as added", () => {
    const incoming: IncomingOrderItem[] = [{ productVariantId: BLACK_M, quantity: 2, unitPrice: 13, discount: 0 }];
    const diff = diffOrderItems([], incoming);
    expect(diff.added).toEqual(incoming);
  });

  it("classifies a variant swap on the same line as changed", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL })];
    const incoming: IncomingOrderItem[] = [
      { id: "item-1", productVariantId: WHITE_XXL, quantity: 1, unitPrice: 11, discount: 0 },
    ];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].old.productVariantId).toBe(WHITE_XL);
    expect(diff.changed[0].new.productVariantId).toBe(WHITE_XXL);
  });

  it("classifies a quantity-only change as changed", () => {
    const existing = [existingItem({ quantity: 1 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 2, unitPrice: 11, discount: 0 }];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.changed).toHaveLength(1);
  });

  it("classifies a price/discount-only change as changed even though stock is unaffected", () => {
    const existing = [existingItem({ unitPrice: 11, discount: 0 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 9, discount: 0 }];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.changed).toHaveLength(1);
  });

  it("treats an incoming id that doesn't match any existing item as added, not changed", () => {
    const existing = [existingItem({ id: "item-1" })];
    const incoming: IncomingOrderItem[] = [
      { id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 },
      { id: "some-other-orders-item-id", productVariantId: BLACK_M, quantity: 1, unitPrice: 13, discount: 0 },
    ];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].productVariantId).toBe(BLACK_M);
    expect(diff.changed).toHaveLength(0);
  });

  it("handles a full mixed edit: one unchanged, one changed, one removed, one added", () => {
    const existing = [
      existingItem({ id: "keep", productVariantId: WHITE_XL, quantity: 1 }),
      existingItem({ id: "swap", productVariantId: WHITE_XL, quantity: 1 }),
      existingItem({ id: "drop", productVariantId: BLACK_M, quantity: 2 }),
    ];
    const incoming: IncomingOrderItem[] = [
      { id: "keep", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 },
      { id: "swap", productVariantId: WHITE_XXL, quantity: 1, unitPrice: 11, discount: 0 },
      { productVariantId: BLACK_M, quantity: 1, unitPrice: 13, discount: 0 },
    ];
    const diff = diffOrderItems(existing, incoming);
    expect(diff.unchanged.map((i) => i.id)).toEqual(["keep"]);
    expect(diff.changed.map((c) => c.old.id)).toEqual(["swap"]);
    expect(diff.removed.map((i) => i.id)).toEqual(["drop"]);
    expect(diff.added).toHaveLength(1);
  });
});

describe("computeStockDeltas — variant change: return old stock, deduct new stock", () => {
  it("returns +old quantity and deducts -new quantity for a size/color swap", () => {
    const existing = [existingItem({ id: "item-1", productVariantId: WHITE_XL, quantity: 1 })];
    const incoming: IncomingOrderItem[] = [
      { id: "item-1", productVariantId: WHITE_XXL, quantity: 1, unitPrice: 11, discount: 0 },
    ];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.get(WHITE_XL)).toBe(1); // +1 returned
    expect(deltas.get(WHITE_XXL)).toBe(-1); // -1 deducted
  });

  it("scales the swap deltas with quantity (old qty 2 -> new variant qty 3)", () => {
    const existing = [existingItem({ id: "item-1", productVariantId: WHITE_XL, quantity: 2 })];
    const incoming: IncomingOrderItem[] = [
      { id: "item-1", productVariantId: WHITE_XXL, quantity: 3, unitPrice: 11, discount: 0 },
    ];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.get(WHITE_XL)).toBe(2);
    expect(deltas.get(WHITE_XXL)).toBe(-3);
  });
});

describe("computeStockDeltas — quantity change on the same variant", () => {
  it("deducts the difference when quantity increases (1 -> 2)", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL, quantity: 1 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 2, unitPrice: 11, discount: 0 }];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.get(WHITE_XL)).toBe(-1);
  });

  it("returns the difference when quantity decreases (2 -> 1)", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL, quantity: 2 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 }];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.get(WHITE_XL)).toBe(1);
  });

  it("produces no delta at all when quantity is unchanged", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL, quantity: 1 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 }];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.size).toBe(0);
  });

  it("produces no delta when only price/discount changed (stock-neutral edit)", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL, quantity: 1, unitPrice: 11 })];
    const incoming: IncomingOrderItem[] = [{ id: "item-1", productVariantId: WHITE_XL, quantity: 1, unitPrice: 9, discount: 0 }];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.size).toBe(0);
  });
});

describe("computeStockDeltas — remove item returns full quantity", () => {
  it("returns the item's full quantity to its variant", () => {
    const existing = [existingItem({ productVariantId: WHITE_XL, quantity: 3 })];
    const deltas = computeStockDeltas(diffOrderItems(existing, []));
    expect(deltas.get(WHITE_XL)).toBe(3);
  });
});

describe("computeStockDeltas — add item deducts full quantity", () => {
  it("deducts the new item's full quantity from its variant", () => {
    const incoming: IncomingOrderItem[] = [{ productVariantId: BLACK_M, quantity: 4, unitPrice: 13, discount: 0 }];
    const deltas = computeStockDeltas(diffOrderItems([], incoming));
    expect(deltas.get(BLACK_M)).toBe(-4);
  });
});

describe("computeStockDeltas — multiple lines against the same variant net correctly", () => {
  it("nets two lines sharing a variant to a single combined delta", () => {
    const existing = [
      existingItem({ id: "a", productVariantId: WHITE_XL, quantity: 1 }),
      existingItem({ id: "b", productVariantId: BLACK_M, quantity: 1 }),
    ];
    // "a" is removed (returns 1 to WHITE_XL) and "b" is swapped onto WHITE_XL qty 2 (deducts 2).
    const incoming: IncomingOrderItem[] = [
      { id: "b", productVariantId: WHITE_XL, quantity: 2, unitPrice: 11, discount: 0 },
    ];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    // +1 (a removed) + -2 (b's new deduction) = -1 net deduction on WHITE_XL.
    expect(deltas.get(WHITE_XL)).toBe(-1);
    expect(deltas.get(BLACK_M)).toBe(1); // b's old variant fully returned
  });

  it("omits a variant entirely when its net delta cancels out to zero", () => {
    const existing = [
      existingItem({ id: "a", productVariantId: WHITE_XL, quantity: 1 }),
      existingItem({ id: "b", productVariantId: BLACK_M, quantity: 1 }),
    ];
    // a: WHITE_XL -> BLACK_M (returns 1 to WHITE_XL, deducts 1 from BLACK_M)
    // b: BLACK_M -> WHITE_XL (returns 1 to BLACK_M, deducts 1 from WHITE_XL)
    const incoming: IncomingOrderItem[] = [
      { id: "a", productVariantId: BLACK_M, quantity: 1, unitPrice: 13, discount: 0 },
      { id: "b", productVariantId: WHITE_XL, quantity: 1, unitPrice: 11, discount: 0 },
    ];
    const deltas = computeStockDeltas(diffOrderItems(existing, incoming));
    expect(deltas.size).toBe(0);
  });
});

describe("calculateOrderTotals", () => {
  it("computes subtotal, discount, and grand total from line items plus delivery charge", () => {
    const totals = calculateOrderTotals(
      [
        { quantity: 2, unitPrice: 11, discount: 1 },
        { quantity: 1, unitPrice: 13, discount: 0 },
      ],
      1.5,
    );
    // subtotal = 2*11 + 1*13 = 35; discount = 1; grand = 35 - 1 + 1.5 = 35.5
    expect(totals.subtotal).toBe(35);
    expect(totals.discountTotal).toBe(1);
    expect(totals.grandTotal).toBe(35.5);
  });

  it("never returns a negative grand total even if discount exceeds subtotal", () => {
    const totals = calculateOrderTotals([{ quantity: 1, unitPrice: 5, discount: 20 }], 0);
    expect(totals.grandTotal).toBe(0);
  });

  it("returns zero totals for an empty item list", () => {
    const totals = calculateOrderTotals([], 0);
    expect(totals).toEqual({ subtotal: 0, discountTotal: 0, grandTotal: 0 });
  });
});
