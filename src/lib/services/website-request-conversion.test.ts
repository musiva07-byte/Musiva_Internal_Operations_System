/**
 * Tests for convertWebsiteRequestToOrder() (Unit 2G — Convert to Order).
 *
 * This is the only point where a website request results in real stock deduction, so these
 * tests focus on: status/validity gating, customer reuse (never duplicated, never silently
 * overwritten), reuse of createOrder() for the actual order/items/stock/delivery/payment
 * work, the idempotent link update (double-conversion guard), and best-effort rollback when
 * that link update loses a race.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFrom,
  mockRequireStaffPermission,
  mockCreateAuditLog,
  mockFindOrCreateCustomer,
  mockCreateOrder,
  mockCancelOrder,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockFindOrCreateCustomer: vi.fn(),
  mockCreateOrder: vi.fn(),
  mockCancelOrder: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

vi.mock("./audit.service", () => ({
  createAuditLog: mockCreateAuditLog,
}));

vi.mock("./customer.service", () => ({
  findOrCreateCustomer: mockFindOrCreateCustomer,
}));

vi.mock("./order.service", () => ({
  createOrder: mockCreateOrder,
  cancelOrder: mockCancelOrder,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { convertWebsiteRequestToOrder } from "./website-request.service";

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

const baseRequest = {
  id: "req-1",
  request_number: "MWR-20260717-0002",
  product_id: "product-1",
  product_variant_id: "variant-1",
  product_name_snapshot: "A-line Top",
  color_snapshot: "Black",
  size_snapshot: "M",
  quantity: 2,
  unit_price_snapshot: 11,
  total_snapshot: 22,
  customer_name: "Fatima Ali",
  mobile_display: "33331101",
  mobile_normalized: "+97333331101",
  whatsapp_display: "33331101",
  whatsapp_normalized: "+97333331101",
  governorate: "Capital Governorate",
  area: "Manama",
  block: null,
  road: null,
  building: null,
  flat: null,
  landmark: null,
  delivery_notes: null,
  payment_preference: "cash_on_delivery",
  status: "confirmed",
  whatsapp_message: "Hello Moosiva...",
  converted_order_id: null,
  converted_at: null,
  converted_by: null,
  created_at: "2026-07-17T10:00:00.000Z",
  updated_at: "2026-07-17T10:00:00.000Z",
};

const variantRow = { id: "variant-1", stock_quantity: 5 };
const customerRow = {
  id: "customer-1",
  full_name: "Fatima Ali",
  mobile: "33331101",
  mobile_normalized: "+97333331101",
  whatsapp: "33331101",
  whatsapp_normalized: "+97333331101",
  email: null,
  governorate: "Capital Governorate",
  area: "Manama",
  block: null,
  road: null,
  building: null,
  flat: null,
  landmark: null,
  delivery_notes: null,
};
const orderRow = { id: "order-1", order_number: "MSV-10050" };

function mockAuth(granted: boolean) {
  if (granted) {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "sales_staff",
      error: null,
    });
  } else {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mockFindOrCreateCustomer.mockResolvedValue({ error: null, data: customerRow });
  mockCreateOrder.mockResolvedValue({ error: null, data: orderRow });
  mockCancelOrder.mockResolvedValue({ error: null, data: { id: "order-1" } });
});

describe("convertWebsiteRequestToOrder — permissions", () => {
  it("blocks a user who lacks order-creation permission", async () => {
    mockAuth(false);

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

describe("convertWebsiteRequestToOrder — status gating", () => {
  it("blocks conversion for a cancelled request", async () => {
    mockAuth(true);
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, status: "cancelled" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toMatch(/cancelled requests cannot be converted/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion for a new request with the exact required message", async () => {
    mockAuth(true);
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, status: "new" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("Confirm this request before converting it to an order.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion for a contacted request", async () => {
    mockAuth(true);
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, status: "contacted" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("Confirm this request before converting it to an order.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("returns not-found for a request that does not exist", async () => {
    mockAuth(true);
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: null, error: null }));

    const result = await convertWebsiteRequestToOrder("missing");

    expect(result.error).toBe("Website request was not found.");
  });
});

describe("convertWebsiteRequestToOrder — pre-conversion validation", () => {
  it("blocks conversion when the product/variant no longer exists", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null })) // request
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })); // variant lookup

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("This product is no longer available. Please handle this request manually.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion when stock is insufficient", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "variant-1", stock_quantity: 1 }, error: null })); // only 1 in stock, request wants 2

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("Not enough stock to convert this request into an order.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion for an invalid (zero/negative) quantity", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, quantity: 0 }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toMatch(/invalid quantity/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion when customer details are missing", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, customer_name: "" }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toMatch(/missing customer details/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks conversion when the delivery address is not a valid Bahrain governorate", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, governorate: "" }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toMatch(/valid delivery address/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

describe("convertWebsiteRequestToOrder — idempotency", () => {
  it("returns the already-converted message (with order number) without doing any work", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, converted_order_id: "order-99" }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { order_number: "MSV-10099" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("This website request has already been converted to order MSV-10099.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(mockFindOrCreateCustomer).not.toHaveBeenCalled();
  });

  it("rolls back (cancels) the just-created order when the link update loses a race", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null })) // request
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null })) // variant
      .mockReturnValueOnce(chainResolveAll({ data: null, error: null })) // link update loses the race
      .mockReturnValueOnce(chainResolveAll({ data: { converted_order_id: "order-winning" }, error: null })) // re-fetch
      .mockReturnValueOnce(chainResolveAll({ data: { order_number: "MSV-10077" }, error: null })); // winning order number

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(mockCancelOrder).toHaveBeenCalledWith("order-1");
    expect(result.error).toBe("This website request has already been converted to order MSV-10077.");
  });
});

describe("convertWebsiteRequestToOrder — customer reuse / create", () => {
  it("reuses an existing customer via findOrCreateCustomer (never creates a duplicate)", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null })); // link update succeeds

    await convertWebsiteRequestToOrder("req-1");

    expect(mockFindOrCreateCustomer).toHaveBeenCalledWith(
      "Fatima Ali",
      "33331101",
      "33331101",
    );
    expect(mockFindOrCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it("passes the reused customer's own current data back through createOrder (no silent overwrite)", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    await convertWebsiteRequestToOrder("req-1");

    const createOrderInput = mockCreateOrder.mock.calls[0][0];
    expect(createOrderInput.customerId).toBe("customer-1");
    expect(createOrderInput.customer.fullName).toBe(customerRow.full_name);
    expect(createOrderInput.customer.mobile).toBe(customerRow.mobile);
  });

  it("surfaces a friendly error when customer lookup/creation fails", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }));
    mockFindOrCreateCustomer.mockResolvedValue({ error: "Invalid Bahrain mobile number.", data: null });

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("Invalid Bahrain mobile number.");
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

describe("convertWebsiteRequestToOrder — order creation", () => {
  it("creates the order via createOrder() with the website request's item, source, and delivery info", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ orderId: "order-1", orderNumber: "MSV-10050" });

    const createOrderInput = mockCreateOrder.mock.calls[0][0];
    expect(createOrderInput.orderSource).toBe("website_request");
    expect(createOrderInput.fulfilmentMethod).toBe("delivery");
    expect(createOrderInput.deliveryAddress.governorate).toBe("Capital Governorate");
    expect(createOrderInput.items).toEqual([
      { productVariantId: "variant-1", quantity: 2, unitPrice: 11, discount: 0 },
    ]);
    expect(createOrderInput.amountPaid).toBe(0);
  });

  it("maps cash_on_delivery to COD payment status, unpaid otherwise", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    await convertWebsiteRequestToOrder("req-1");
    expect(mockCreateOrder.mock.calls[0][0].paymentStatus).toBe("cod");
    expect(mockCreateOrder.mock.calls[0][0].paymentMethod).toBe("cash_on_delivery");

    vi.clearAllMocks();
    mockAuth(true);
    mockFindOrCreateCustomer.mockResolvedValue({ error: null, data: customerRow });
    mockCreateOrder.mockResolvedValue({ error: null, data: orderRow });
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { ...baseRequest, payment_preference: "benefitpay" }, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    await convertWebsiteRequestToOrder("req-1");
    expect(mockCreateOrder.mock.calls[0][0].paymentStatus).toBe("unpaid");
    expect(mockCreateOrder.mock.calls[0][0].paymentMethod).toBe("benefitpay");
  });

  it("does not mark the order as paid — amountPaid is always 0", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    await convertWebsiteRequestToOrder("req-1");
    expect(mockCreateOrder.mock.calls[0][0].amountPaid).toBe(0);
  });

  it("surfaces createOrder's own error (e.g. a stock race) without creating a duplicate", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }));
    mockCreateOrder.mockResolvedValue({ error: "Not enough stock available.", data: null });

    const result = await convertWebsiteRequestToOrder("req-1");

    expect(result.error).toBe("Not enough stock available.");
  });
});

describe("convertWebsiteRequestToOrder — linking, audit, and no cost leak", () => {
  it("links the request to the order with an atomic, conditional update", async () => {
    mockAuth(true);
    let updatePayload: Record<string, unknown> | null = null;
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockImplementationOnce(() => {
        const proxy = {
          update: (payload: Record<string, unknown>) => {
            updatePayload = payload;
            return proxy;
          },
          eq: () => proxy,
          is: () => proxy,
          select: () => proxy,
          maybeSingle: () => Promise.resolve({ data: { id: "req-1" }, error: null }),
        };
        return proxy;
      });

    await convertWebsiteRequestToOrder("req-1");

    expect(updatePayload).toMatchObject({ converted_order_id: "order-1" });
    expect((updatePayload as unknown as Record<string, unknown>).converted_by).toBe("user-1");
    expect((updatePayload as unknown as Record<string, unknown>).converted_at).toBeTruthy();
  });

  it("creates a website_request_converted_to_order audit log entry with request and order identifiers", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    await convertWebsiteRequestToOrder("req-1");

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "website_request_converted_to_order",
        recordId: "req-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          request_number: "MWR-20260717-0002",
          order_id: "order-1",
          order_number: "MSV-10050",
        }),
      }),
    );
  });

  it("never exposes cost, profit, or margin fields — the result only contains order id/number", async () => {
    mockAuth(true);
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: baseRequest, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variantRow, error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: { id: "req-1" }, error: null }));

    const result = await convertWebsiteRequestToOrder("req-1");
    const serialized = JSON.stringify(result.data).toLowerCase();

    for (const forbidden of ["cost_price", "landed_cost", "profit", "margin", "supplier", "barcode", "sku"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
