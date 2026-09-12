/**
 * Tests for createOrder()'s server-side re-validation (order.service.ts) — the New Sale wizard
 * must never trust its own search-result snapshot when actually placing the order. Between a
 * staff member searching for a variant and clicking "Create order", its stock, or even its
 * active status, could have changed (another sale, an archive, a stock correction). This is
 * test L from the New Sale search fix: "Final order creation still revalidates stock."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRequireStaffPermission } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

import { createOrder } from "./order.service";
import type { CreateOrderInput } from "@/lib/validations/order.schema";

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

function validOrderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customer: { fullName: "Test Customer", mobile: "33112233" },
    fulfilmentMethod: "walk_in",
    orderSource: "walk_in",
    orderStatus: "new",
    paymentStatus: "unpaid",
    paymentMethod: null,
    deliveryCharge: 0,
    amountPaid: 0,
    items: [{ productVariantId: VARIANT_ID, quantity: 1, unitPrice: 11, discount: 0 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom },
    userId: "staff-1",
    role: "owner",
    error: null,
  });
});

describe("createOrder — final stock/status revalidation (test L)", () => {
  it("rejects with a friendly, specific message when stock dropped below the requested quantity", async () => {
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [
          {
            id: VARIANT_ID,
            status: "active",
            stock_quantity: 0,
            color: "BLACK",
            size: "XXL",
            products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
          },
        ],
        error: null,
      }),
    );

    const result = await createOrder(validOrderInput({ items: [{ productVariantId: VARIANT_ID, quantity: 1, unitPrice: 11, discount: 0 }] }));

    expect(result.error).toBe("Not enough stock for KURTHI CODE SET — BLACK / XXL. Available: 0.");
  });

  it("rejects when the variant has been made inactive/archived since the staff member searched", async () => {
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [
          {
            id: VARIANT_ID,
            status: "archived",
            stock_quantity: 5,
            color: "BLACK",
            size: "XXL",
            products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
          },
        ],
        error: null,
      }),
    );

    const result = await createOrder(validOrderInput());

    expect(result.error).toBe("KURTHI CODE SET — BLACK / XXL is no longer available for sale.");
  });

  it("rejects when the product itself has been archived, even if the variant row is still 'active'", async () => {
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [
          {
            id: VARIANT_ID,
            status: "active",
            stock_quantity: 5,
            color: "BLACK",
            size: "XXL",
            products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "archived" },
          },
        ],
        error: null,
      }),
    );

    const result = await createOrder(validOrderInput());

    expect(result.error).toBe("KURTHI CODE SET — BLACK / XXL is no longer available for sale.");
  });

  it("rejects when a selected variant no longer exists at all", async () => {
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    const result = await createOrder(validOrderInput());

    expect(result.error).toBe("Please select valid products.");
  });
});
