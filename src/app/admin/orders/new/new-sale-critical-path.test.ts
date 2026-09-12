/**
 * STAFF CRITICAL PATH — New Sale product search.
 *
 * These tests exist because of a real incident: on 2026-09-12, Product Catalog search found a
 * product by its code (`16B1ACD5` — KURTHI CODE SET), but New Sale's item picker searched only
 * `products.name` and returned "No products found." for the exact same code, blocking a sale.
 *
 * This file is named and organized as a business-behavior regression guard, not just a code
 * test — see AGENTS.md/CLAUDE.md section 41 ("Development Safety Rules") and
 * context/staff-workflow-smoke-tests.md. Any change to Product Catalog search, product SKU
 * fields, product variant queries, website visibility, stock filtering, or the New Sale item
 * picker MUST keep every test below passing before merge/deploy.
 *
 * Deeper mechanical coverage of the search query itself lives in
 * src/lib/services/order-product-search.test.ts and the createOrder revalidation lives in
 * src/lib/services/order-create-validation.test.ts — this file is the smaller, business-language
 * signpost suite a future developer should read first to understand *why* those exist.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRequireStaffPermission } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

import { createOrder, listOrderableVariants } from "@/lib/services/order.service";
import { listProducts } from "@/lib/services/product.service";
import type { CreateOrderInput } from "@/lib/validations/order.schema";

type CallLogEntry = { method: string; args: unknown[] };

function chainResolveAll(result: unknown, callLog?: CallLogEntry[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        }
        return (...args: unknown[]) => {
          callLog?.push({ method: String(prop), args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function kurthiVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "kurthi-variant-1",
    product_id: "kurthi-product-1",
    status: "active",
    stock_quantity: 1,
    color: "BLACK",
    size: "XXL",
    variant_sku: "16B1ACD5-BLK-XXL",
    selling_price: 11,
    regular_selling_price_bhd: 11,
    discount_price_bhd: null,
    discount_start_at: null,
    discount_end_at: null,
    updated_at: "2026-09-01T00:00:00Z",
    products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
    ...overrides,
  };
}

const VARIANT_ID = "22222222-2222-4222-8222-222222222222";

function validOrderInput(): CreateOrderInput {
  return {
    customer: { fullName: "Test Customer", mobile: "33112233" },
    fulfilmentMethod: "walk_in",
    orderSource: "walk_in",
    orderStatus: "new",
    paymentStatus: "unpaid",
    paymentMethod: null,
    deliveryCharge: 0,
    amountPaid: 0,
    items: [{ productVariantId: VARIANT_ID, quantity: 5, unitPrice: 11, discount: 0 }],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("STAFF CRITICAL PATH: New Sale product search", () => {
  it("staff can find product by product code during new sale", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "kurthi-product-1" }], error: null })) // products: sku match
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })) // categories: no match
      .mockReturnValueOnce(chainResolveAll({ data: [kurthiVariant()], error: null })); // product_variants

    const results = await listOrderableVariants({ q: "16B1ACD5" });

    expect(results).toHaveLength(1);
    expect(results[0].product_name).toBe("KURTHI CODE SET");
    expect(results[0].product_sku).toBe("16B1ACD5");
  });

  it("a product-level code returns every active in-stock variant under that product, not just one", async () => {
    const variants = [
      kurthiVariant({ id: "v-1", color: "BLACK", size: "XXL" }),
      kurthiVariant({ id: "v-2", color: "DUSTY PURPLE", size: "L" }),
      kurthiVariant({ id: "v-3", color: "BOTTLE GREEN", size: "XL" }),
    ];
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "kurthi-product-1" }], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: variants, error: null }));

    const results = await listOrderableVariants({ q: "16B1ACD5" });

    expect(results).toHaveLength(3);
    expect(new Set(results.map((r) => r.product_name))).toEqual(new Set(["KURTHI CODE SET"]));
  });

  it("website hidden product can still be sold internally (active + in stock is enough)", async () => {
    // The safe select never includes website_visible/online_status at all — a hidden product's
    // active, in-stock variant flows through untouched, exactly like operation.moosivabh.com's
    // real KURTHI CODE SET record (online_status: "hidden") did in live QA.
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [kurthiVariant({ products: { name: "Hidden But Sellable", sku: "HID-1", status: "active" } })],
        error: null,
      }),
    );

    const results = await listOrderableVariants();

    expect(results).toHaveLength(1);
    expect(results[0].product_name).toBe("Hidden But Sellable");
  });

  it("inactive or archived products never appear, even if a variant row is still marked active", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    expect(
      callLog.some((c) => c.method === "eq" && c.args[0] === "products.status" && c.args[1] === "active"),
    ).toBe(true);
  });

  it("out-of-stock variants are hidden by default, with an explicit opt-in to show them", async () => {
    const defaultCallLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, defaultCallLog));
    await listOrderableVariants();
    expect(defaultCallLog.some((c) => c.method === "gt" && c.args[0] === "stock_quantity")).toBe(true);

    const toggledCallLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, toggledCallLog));
    await listOrderableVariants({ includeOutOfStock: true });
    expect(toggledCallLog.some((c) => c.method === "gt")).toBe(false);
  });

  it("new sale search matches product catalog SKU behavior — same product-level filter fields, byte for byte", async () => {
    // This is the exact regression this suite exists to prevent: the two search paths must stay
    // structurally in sync, so a product code that Product Catalog can find is guaranteed
    // findable in New Sale too — not just "usually," but by construction.
    const catalogCallLog: CallLogEntry[] = [];
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], count: 0, error: null }, catalogCallLog));
    await listProducts({ q: "16B1ACD5" });
    const catalogOrCall = catalogCallLog.find((c) => c.method === "or");

    vi.resetAllMocks();

    const newSaleCallLog: CallLogEntry[] = [];
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }, newSaleCallLog))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));
    await listOrderableVariants({ q: "16B1ACD5" });
    const newSaleOrCall = newSaleCallLog.find((c) => c.method === "or");

    expect(catalogOrCall?.args[0]).toBeTruthy();
    expect(newSaleOrCall?.args[0]).toBeTruthy();
    // Same product-level fields (name, sku, collection) in the same order — a byte-for-byte
    // match, not just "both mention sku somewhere".
    expect(newSaleOrCall?.args[0]).toBe(catalogOrCall?.args[0]);
  });

  it("private/cost fields are never selected for the New Sale picker", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    const selectString = String(callLog.find((c) => c.method === "select")?.args[0] ?? "");
    expect(selectString).not.toMatch(/cost|barcode|supplier|landed/i);
  });
});

describe("STAFF CRITICAL PATH: order creation never trusts the picker alone", () => {
  beforeEach(() => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "staff-1",
      role: "sales_staff",
      error: null,
    });
  });

  it("order creation blocks insufficient stock with friendly message, not a raw database error", async () => {
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [
          {
            id: VARIANT_ID,
            status: "active",
            stock_quantity: 1, // staff requested 5 in validOrderInput()
            color: "BLACK",
            size: "XXL",
            products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
          },
        ],
        error: null,
      }),
    );

    const result = await createOrder(validOrderInput());

    expect(result.error).toBe("Not enough stock for KURTHI CODE SET — BLACK / XXL. Available: 1.");
    // Never a raw Postgres/Supabase error string leaking to staff.
    expect(result.error).not.toMatch(/postgres|supabase|constraint|violat|null value/i);
  });
});
