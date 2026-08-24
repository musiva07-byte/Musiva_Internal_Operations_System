/**
 * Tests for updateOrderItems() (order.service.ts) — the "change variant/size/color/quantity
 * without creating a duplicate order" workflow (Order Edit). The diff/delta math itself is
 * covered exhaustively in order-item-changes.test.ts; these tests focus on what this function
 * adds on top: permission gating (including the stricter completed-order/delivered-delivery
 * rule), stock validation before any write, routing through add_variant_stock /
 * deduct_variant_stock (never a direct product_variants update), order_items writes, total
 * recalculation, and the audit log.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc, mockRequireStaffPermission, mockCreateAuditLog } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

vi.mock("./audit.service", () => ({
  createAuditLog: mockCreateAuditLog,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateOrderItems } from "./order.service";

function chainResolveAll(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
      },
    },
  );
  return proxy;
}

const WHITE_XL = "11111111-1111-4111-8111-111111111111";
const WHITE_XXL = "22222222-2222-4222-8222-222222222222";
const BLACK_M = "33333333-3333-4333-8333-333333333333";
const ITEM_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const baseOrder = {
  id: "order-1",
  order_number: "MSV-10010",
  order_status: "confirmed",
  payment_status: "paid",
  amount_paid: 12,
  grand_total: 12,
  delivery_charge: 0,
  deliveries: [] as { delivery_status: string }[],
};

const itemA = {
  id: ITEM_A_ID,
  product_variant_id: WHITE_XL,
  quantity: 1,
  unit_price: 12,
  discount: 0,
};

const itemB = {
  id: ITEM_B_ID,
  product_variant_id: BLACK_M,
  quantity: 1,
  unit_price: 13,
  discount: 0,
};

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WHITE_XL,
    status: "active",
    stock_quantity: 5,
    color: "White",
    size: "XL",
    variant_sku: "SKU-WHITE-XL",
    products: { name: "Satin Dress", sku: "MSV-10001" },
    ...overrides,
  };
}

function mockAuth(role: string) {
  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom, rpc: mockRpc },
    userId: "user-1",
    role,
    error: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("updateOrderItems — permissions", () => {
  it("blocks a role without order-management permission before touching the database", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });

    const result = await updateOrderItems("order-1", { items: [{ productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }] });

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns not-found for a missing order", async () => {
    mockAuth("owner");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: null, error: null }));

    const result = await updateOrderItems("missing", { items: [{ productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }] });

    expect(result.error).toBe("Order was not found.");
  });

  it("blocks editing a cancelled order", async () => {
    mockAuth("owner");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "cancelled" }, error: null }));

    const result = await updateOrderItems("order-1", { items: [{ productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }] });

    expect(result.error).toMatch(/cancelled/i);
  });

  it("blocks sales_staff from editing a completed order", async () => {
    mockAuth("sales_staff");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "completed" }, error: null }));

    const result = await updateOrderItems("order-1", { items: [{ productVariantId: WHITE_XL, quantity: 2, unitPrice: 12, discount: 0 }] });

    expect(result.error).toBe("This order is already completed. Only an owner or manager can edit it.");
  });

  it("blocks sales_staff from editing an order whose delivery already reached 'delivered'", async () => {
    mockAuth("sales_staff");
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: { ...baseOrder, order_status: "in_fulfilment", deliveries: [{ delivery_status: "delivered" }] },
        error: null,
      }),
    );

    const result = await updateOrderItems("order-1", { items: [{ productVariantId: WHITE_XL, quantity: 2, unitPrice: 12, discount: 0 }] });

    expect(result.error).toBe("This order has already been delivered. Only an owner or manager can edit it.");
  });

  it("allows owner to edit a completed order", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "completed" }, error: null })) // order
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null })) // existing items
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ stock_quantity: 5 })], error: null })) // variants
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items update
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "completed" }, error: null })) // orders totals update
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })); // final items refetch
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 2, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBeNull();
  });
});

describe("updateOrderItems — validation", () => {
  it("returns a friendly error when nothing actually changed", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }));

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBe("No changes were made to this order.");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("blocks the save with the exact required message when stock is insufficient", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ stock_quantity: 1 })], error: null }));

    // Increasing quantity 1 -> 5 on a variant with only 1 in stock.
    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 5, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBe("Not enough stock available for this size/color.");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("blocks the save when the target variant is not active", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }))
      .mockReturnValueOnce(
        chainResolveAll({
          data: [
            variantRow({ id: WHITE_XL }),
            variantRow({ id: WHITE_XXL, status: "inactive", color: "White", size: "XXL" }),
          ],
          error: null,
        }),
      );

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XXL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBe("White / XXL is no longer available.");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("blocks the save when the selected variant no longer exists", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })); // variant fetch comes back empty

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XXL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBe("One of the selected products is no longer available.");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("updateOrderItems — stock movements route through the RPCs, never a direct table write", () => {
  it("deducts via deduct_variant_stock when quantity increases on the same variant", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null })) // order
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null })) // existing items
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ stock_quantity: 5 })], error: null })) // variants
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items update
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, grand_total: 24, amount_due: 12 }, error: null })) // totals update
      .mockReturnValueOnce(chainResolveAll({ data: [{ ...itemA, quantity: 2 }], error: null })); // final refetch
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 2, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith(
      "deduct_variant_stock",
      expect.objectContaining({ p_variant_id: WHITE_XL, p_quantity: 1, p_reference_type: "order_item_correction", p_reference_id: "order-1" }),
    );
    expect(result.data?.grand_total).toBe(24);
  });

  it("returns stock via add_variant_stock (return_added) when quantity decreases on the same variant", async () => {
    mockAuth("owner");
    const twoQtyItem = { ...itemA, quantity: 2 };
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [twoQtyItem], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ stock_quantity: 5 })], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items update
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null })) // totals update
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null })); // final refetch
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith(
      "add_variant_stock",
      expect.objectContaining({ p_variant_id: WHITE_XL, p_quantity: 1, p_movement_type: "return_added" }),
    );
  });

  it("returns old variant stock and deducts new variant stock for a size/color swap", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }))
      .mockReturnValueOnce(
        chainResolveAll({
          data: [variantRow({ stock_quantity: 5 }), variantRow({ id: WHITE_XXL, color: "White", size: "XXL", stock_quantity: 5 })],
          error: null,
        }),
      )
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items update
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null })) // totals update
      .mockReturnValueOnce(chainResolveAll({ data: [{ ...itemA, product_variant_id: WHITE_XXL }], error: null })); // final refetch
    mockRpc
      .mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null })) // add_variant_stock (old)
      .mockReturnValueOnce(chainResolveAll({ data: { id: "movement-2" }, error: null })); // deduct_variant_stock (new)

    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XXL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenNthCalledWith(
      1,
      "add_variant_stock",
      expect.objectContaining({ p_variant_id: WHITE_XL, p_quantity: 1, p_movement_type: "return_added" }),
    );
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "deduct_variant_stock",
      expect.objectContaining({ p_variant_id: WHITE_XXL, p_quantity: 1 }),
    );
  });

  it("returns full quantity to stock when an item is removed", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA, itemB], error: null })) // two existing items
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ id: WHITE_XL }), variantRow({ id: BLACK_M })], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items delete
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, grand_total: 12 }, error: null })) // totals update
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null })); // final refetch
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    // Only item-a submitted — item-b is implicitly removed.
    const result = await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 }],
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith(
      "add_variant_stock",
      expect.objectContaining({ p_variant_id: BLACK_M, p_quantity: 1, p_movement_type: "return_added" }),
    );
  });

  it("deducts the full quantity from stock when a new item is added", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null })) // one existing, kept unchanged
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ id: WHITE_XL }), variantRow({ id: BLACK_M })], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // order_items insert
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, grand_total: 25 }, error: null })) // totals update
      .mockReturnValueOnce(chainResolveAll({ data: [itemA, itemB], error: null })); // final refetch
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    const result = await updateOrderItems("order-1", {
      items: [
        { id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 1, unitPrice: 12, discount: 0 },
        { productVariantId: BLACK_M, quantity: 1, unitPrice: 13, discount: 0 },
      ],
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith(
      "deduct_variant_stock",
      expect.objectContaining({ p_variant_id: BLACK_M, p_quantity: 1 }),
    );
  });
});

describe("updateOrderItems — audit log", () => {
  it("records an update_order_items audit log entry with old/new details and stock deltas", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [itemA], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ stock_quantity: 5 })], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, grand_total: 24 }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [{ ...itemA, quantity: 2 }], error: null }));
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    await updateOrderItems("order-1", {
      items: [{ id: ITEM_A_ID, productVariantId: WHITE_XL, quantity: 2, unitPrice: 12, discount: 0 }],
      note: "Customer changed size",
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_order_items",
        recordId: "order-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          order_number: "MSV-10010",
          note: "Customer changed size",
        }),
      }),
    );
  });
});
