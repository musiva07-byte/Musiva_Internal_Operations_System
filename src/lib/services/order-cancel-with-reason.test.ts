/**
 * Tests for cancelOrderWithReason() (order.service.ts) — the "Cancel / Mark duplicate" safe
 * cleanup action for a wrong order (e.g. MSV-10010 replaced by a size/color correction). Unlike
 * cancelOrder(), this also works on completed/paid orders (owner/manager only), always
 * requires a reason, and lets staff choose whether to return items to stock.
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

import { cancelOrderWithReason } from "./order.service";

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

const VARIANT_ID = "11111111-1111-4111-8111-111111111111";

const baseOrder = {
  id: "order-1",
  order_number: "MSV-10010",
  order_status: "confirmed",
  notes: null,
};

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

describe("cancelOrderWithReason — validation", () => {
  it("requires a reason of at least 3 characters before touching the database", async () => {
    mockAuth("owner");

    const result = await cancelOrderWithReason("order-1", { reason: "ok", returnStock: true });

    expect(result.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("cancelOrderWithReason — permissions", () => {
  it("blocks an unauthorized role before touching the database", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });

    const result = await cancelOrderWithReason("order-1", { reason: "Customer changed size", returnStock: true });

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("blocks sales_staff from cancelling a completed order", async () => {
    mockAuth("sales_staff");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "completed" }, error: null }));

    const result = await cancelOrderWithReason("order-1", { reason: "Customer changed size", returnStock: true });

    expect(result.error).toBe("Only an owner or manager can cancel a completed order.");
  });

  it("allows owner to cancel a completed order", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "completed" }, error: null })) // fetch
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "cancelled" }, error: null })) // update
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })); // items (returnStock=false path skips this, but keep for safety)

    const result = await cancelOrderWithReason("order-1", {
      reason: "Customer changed size; correct order created as MSV-10012.",
      returnStock: false,
    });

    expect(result.error).toBeNull();
  });

  it("blocks cancelling an already-cancelled order", async () => {
    mockAuth("owner");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "cancelled" }, error: null }));

    const result = await cancelOrderWithReason("order-1", { reason: "Customer changed size", returnStock: true });

    expect(result.error).toBe("This order is already cancelled.");
  });

  it("returns not-found for a missing order", async () => {
    mockAuth("owner");
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: null, error: null }));

    const result = await cancelOrderWithReason("missing", { reason: "Customer changed size", returnStock: true });

    expect(result.error).toBe("Order was not found.");
  });
});

describe("cancelOrderWithReason — stock return", () => {
  it("returns each item's full quantity via add_variant_stock (cancelled_order_restore) when returnStock is true", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null })) // fetch
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null })) // update to cancelled
      .mockReturnValueOnce(
        chainResolveAll({ data: [{ product_variant_id: VARIANT_ID, quantity: 2 }], error: null }),
      ); // items
    mockRpc.mockReturnValueOnce(chainResolveAll({ data: { id: "movement-1" }, error: null }));

    const result = await cancelOrderWithReason("order-1", {
      reason: "Customer changed size; correct order created as MSV-10012.",
      linkedOrderNumber: "MSV-10012",
      returnStock: true,
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith(
      "add_variant_stock",
      expect.objectContaining({
        p_variant_id: VARIANT_ID,
        p_quantity: 2,
        p_movement_type: "cancelled_order_restore",
        p_reference_type: "order",
        p_reference_id: "order-1",
      }),
    );
  });

  it("never calls add_variant_stock when returnStock is false", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }));

    const result = await cancelOrderWithReason("order-1", {
      reason: "Duplicate order, no stock was ever received against it.",
      returnStock: false,
    });

    expect(result.error).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("cancelOrderWithReason — audit trail and history", () => {
  it("never deletes the order — only updates status to cancelled and records the reason", async () => {
    mockAuth("owner");
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseOrder, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseOrder, order_status: "cancelled" }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    await cancelOrderWithReason("order-1", {
      reason: "Customer changed size; correct order created as MSV-10012.",
      linkedOrderNumber: "MSV-10012",
      returnStock: true,
    });

    expect(mockFrom).not.toHaveBeenCalledWith("order_items", "delete");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cancel_order",
        recordId: "order-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          order_number: "MSV-10010",
          reason: "Customer changed size; correct order created as MSV-10012.",
          linked_order_number: "MSV-10012",
          stock_returned: true,
        }),
      }),
    );
  });
});
