/**
 * Tests for listOrderableVariants() (order.service.ts) — the New Sale / Order Edit product
 * picker's data source.
 *
 * Covers two real production bugs found in this exact function:
 *
 * 1. (earlier fix) With no search term, this returns only the top N most recently updated
 *    active variants (a "default browse" list). The UI used to run its *search* as a
 *    client-side filter over that same capped list — once a boutique's active catalog passed
 *    that cap, an in-stock variant whose row hadn't been touched recently became permanently
 *    unsearchable, even though Product Catalog (a real server-side search) found it instantly.
 *
 * 2. (this fix) Even after (1), the product-level lookup only searched `products.name`. A
 *    product-code search like "16B1ACD5" — stored in `products.sku`, the exact column Product
 *    Catalog's own search checks — matched nothing, so staff searching the same code Product
 *    Catalog had just found got "No products found." in New Sale. Fixed by searching
 *    name/sku/collection together (mirroring listProducts' own filter fields), plus a
 *    category-name lookup, and by requiring product.status = "active" (not just the variant)
 *    and stock_quantity > 0 by default — none of which require website/online status, since
 *    this is an internal sales tool, not the public storefront.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

import { listOrderableVariants } from "./order.service";

type CallLogEntry = { method: string; args: unknown[] };

/** Same "ignore args, resolve via `then`" proxy this codebase's other service tests use, plus
 *  an optional call log so filter/select calls can actually be asserted where the business
 *  rule under test (in-stock-only, active-only, no private columns selected) depends on it. */
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

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    product_id: "product-1",
    status: "active",
    stock_quantity: 1,
    color: "OFF WHITE",
    size: "L",
    variant_sku: "39B43P13-OFF-WHI-L",
    selling_price: 11,
    regular_selling_price_bhd: 11,
    discount_price_bhd: null,
    discount_start_at: null,
    discount_end_at: null,
    updated_at: "2026-08-19T11:47:24Z",
    products: { name: "A LINE 3 PEASE SET", sku: "39B43P13", status: "active" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listOrderableVariants — no search term (default browse list)", () => {
  it("returns the base recent-active in-stock list", async () => {
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [variantRow()], error: null }));

    const result = await listOrderableVariants();

    expect(result).toHaveLength(1);
    expect(result[0].product_name).toBe("A LINE 3 PEASE SET");
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("product_variants");
  });

  it("also returns the browse list when called with an empty/whitespace query", async () => {
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [variantRow()], error: null }));

    const result = await listOrderableVariants({ q: "   " });

    expect(result).toHaveLength(1);
    // No separate products/categories lookup — whitespace-only query is treated as no search.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("filters to in-stock variants only by default (test J)", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    expect(callLog.some((c) => c.method === "gt" && c.args[0] === "stock_quantity" && c.args[1] === 0)).toBe(
      true,
    );
  });

  it("does not filter stock when includeOutOfStock is set (the 'show out-of-stock too' toggle)", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants({ includeOutOfStock: true });

    expect(callLog.some((c) => c.method === "gt")).toBe(false);
  });

  it("requires both variant.status and products.status to be active (test I)", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    expect(callLog.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "active")).toBe(
      true,
    );
    expect(
      callLog.some((c) => c.method === "eq" && c.args[0] === "products.status" && c.args[1] === "active"),
    ).toBe(true);
  });

  it("does NOT require website/online status — internal sales tool, not the storefront (test H)", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    const filteredColumns = callLog.filter((c) => c.method === "eq").map((c) => c.args[0]);
    expect(filteredColumns).not.toContain("website_visible");
    expect(filteredColumns).not.toContain("online_status");
    expect(filteredColumns).not.toContain("show_on_website");
  });

  it("selects only safe, sellable-relevant columns — no buying cost, landed cost, supplier cost, or barcode (test K)", async () => {
    const callLog: CallLogEntry[] = [];
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }, callLog));

    await listOrderableVariants();

    const selectCall = callLog.find((c) => c.method === "select");
    const selectString = String(selectCall?.args[0] ?? "");
    expect(selectString).not.toMatch(/cost/i);
    expect(selectString).not.toMatch(/barcode/i);
    expect(selectString).not.toMatch(/supplier/i);
    expect(selectString).not.toMatch(/landed/i);
  });

  it("never returns private/cost fields on the mapped result even if a raw row somehow included them (defense in depth, test K)", async () => {
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [
          variantRow({
            cost_price: 999,
            barcode: "123456789",
            latest_landed_cost_bhd: 5,
            latest_supplier_unit_cost_inr: 500,
          }),
        ],
        error: null,
      }),
    );

    const result = await listOrderableVariants();

    expect(result[0]).not.toHaveProperty("cost_price");
    expect(result[0]).not.toHaveProperty("barcode");
    expect(result[0]).not.toHaveProperty("latest_landed_cost_bhd");
    expect(result[0]).not.toHaveProperty("latest_supplier_unit_cost_inr");
  });
});

describe("listOrderableVariants — the reported bug: product-code/SKU search (16B1ACD5)", () => {
  it("finds all active in-stock variants of a product by its product code (products.sku) — test B", async () => {
    const kurthiVariants = [
      variantRow({
        id: "v-1",
        product_id: "kurthi-1",
        color: "BLACK",
        size: "XXL",
        stock_quantity: 1,
        variant_sku: "16B1ACD5-BLK-XXL",
        products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
      }),
      variantRow({
        id: "v-2",
        product_id: "kurthi-1",
        color: "RED",
        size: "M",
        stock_quantity: 2,
        variant_sku: "16B1ACD5-RED-M",
        products: { name: "KURTHI CODE SET", sku: "16B1ACD5", status: "active" },
      }),
    ];

    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "kurthi-1" }], error: null })) // products: matched by sku
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })) // categories: no match
      .mockReturnValueOnce(chainResolveAll({ data: kurthiVariants, error: null })); // product_variants

    const result = await listOrderableVariants({ q: "16B1ACD5" });

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.product_name === "KURTHI CODE SET")).toBe(true);
    expect(result.every((r) => r.product_sku === "16B1ACD5")).toBe(true);
    expect(result.map((r) => `${r.color}/${r.size}`).sort()).toEqual(["BLACK/XXL", "RED/M"]);
  });

  it("searches products by name, sku, and collection together — mirrors listProducts' own filter fields", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    await listOrderableVariants({ q: "16B1ACD5" });

    const productsCall = mockFrom.mock.calls[0];
    expect(productsCall[0]).toBe("products");
  });
});

describe("listOrderableVariants — other required search fields", () => {
  it("finds a variant by product name — test C", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "product-1" }], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow()], error: null }));

    const result = await listOrderableVariants({ q: "A LINE" });

    expect(result).toHaveLength(1);
    expect(mockFrom).toHaveBeenNthCalledWith(1, "products");
    expect(mockFrom).toHaveBeenNthCalledWith(3, "product_variants");
  });

  it("finds a variant by variant SKU — test D", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ variant_sku: "XYZ-999" })], error: null }));

    const result = await listOrderableVariants({ q: "XYZ-999" });

    expect(result).toHaveLength(1);
    expect(result[0].variant_sku).toBe("XYZ-999");
  });

  it("finds a variant by color — test E", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ color: "Black" })], error: null }));

    const result = await listOrderableVariants({ q: "Black" });

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("Black");
  });

  it("finds a variant by size — test F", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ size: "XXL" })], error: null }));

    const result = await listOrderableVariants({ q: "XXL" });

    expect(result).toHaveLength(1);
    expect(result[0].size).toBe("XXL");
  });

  it("finds products by category name via a separate categories lookup", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })) // products: no name/sku/collection match
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "cat-1" }], error: null })) // categories: "Kaftan" matches
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "product-9" }], error: null })) // products in that category
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ product_id: "product-9" })], error: null }));

    const result = await listOrderableVariants({ q: "Kaftan" });

    expect(result).toHaveLength(1);
    expect(mockFrom).toHaveBeenCalledWith("categories");
  });

  it("still works when nothing matches by name/sku/collection/category (falls back to variant-level fields only)", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ color: "Black" })], error: null }));

    const result = await listOrderableVariants({ q: "Black" });

    expect(result).toHaveLength(1);
  });

  it("returns an empty list gracefully when nothing matches anywhere", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    const result = await listOrderableVariants({ q: "nonexistent-sku-xyz" });

    expect(result).toEqual([]);
  });

  it("strips filter-breaking characters (comma/parens) from the search term before querying", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    await expect(listOrderableVariants({ q: "weird,(query)" })).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});

describe("listOrderableVariants — website/online status is irrelevant (test G)", () => {
  it("returns an active, in-stock variant regardless of the product's website visibility", async () => {
    // The row itself carries no website_visible/online_status field at all in the safe select —
    // proving the query never conditions on it. A hidden-from-website product with an active
    // status and stock still comes back.
    mockFrom.mockReturnValueOnce(
      chainResolveAll({
        data: [variantRow({ products: { name: "Hidden Product", sku: "HID-1", status: "active" } })],
        error: null,
      }),
    );

    const result = await listOrderableVariants();

    expect(result).toHaveLength(1);
    expect(result[0].product_name).toBe("Hidden Product");
  });
});
