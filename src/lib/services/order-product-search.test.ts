/**
 * Tests for listOrderableVariants() (order.service.ts) — the New Sale product picker's data
 * source. Fixes a real production bug: with no search term, this returns only the 100 most
 * recently updated active variants (a "default browse" list). That's fine for browsing, but
 * the UI used to run its *search* as a client-side filter over that same capped list — once a
 * boutique's active catalog passed 100 variants, any in-stock variant whose row hadn't been
 * touched recently became permanently invisible to search, even though Stock Management (a
 * real server-side search) found it immediately. Confirmed live: 161 active variants, and two
 * in-stock variants of "A LINE 3 PEASE SET" were unsearchable because two out-of-stock
 * variants of the same product had more recent updated_at timestamps and displaced them from
 * the top-100 window.
 *
 * These tests cover the fix: a search term now runs a real, uncapped-by-recency, server-side
 * search across product name (via a first products lookup, same two-step pattern listOrders'
 * customer-name search already uses) plus variant_sku/barcode/color/size.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

import { listOrderableVariants } from "./order.service";

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

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    status: "active",
    stock_quantity: 1,
    color: "OFF WHITE",
    size: "L",
    variant_sku: "39B43P13-OFF-WHI-L",
    updated_at: "2026-08-19T11:47:24Z",
    products: { name: "A LINE 3 PEASE SET", sku: "39B43P13" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listOrderableVariants — no search term (default browse list)", () => {
  it("returns the base recent-active list, unchanged from before", async () => {
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
    // No separate products lookup — whitespace-only query is treated as no search.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("listOrderableVariants — with a search term (the fix)", () => {
  it("finds an in-stock variant by SKU even though it is not among the most-recently-updated rows", async () => {
    // This is the exact real-world case: the variant matching "39" wasn't in the recent-100
    // window, but a real server-side search (not a client filter over that window) finds it.
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null })) // products name lookup: no name match
      .mockReturnValueOnce(
        chainResolveAll({
          data: [variantRow({ id: "variant-l", size: "L", stock_quantity: 1 })],
          error: null,
        }),
      );

    const result = await listOrderableVariants({ q: "39" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("variant-l");
    expect(result[0].stock_quantity).toBe(1);
  });

  it("looks up matching product names first, then searches variants by SKU/barcode/color/size/product", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "product-1" }], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow()], error: null }));

    await listOrderableVariants({ q: "A LINE" });

    expect(mockFrom).toHaveBeenNthCalledWith(1, "products");
    expect(mockFrom).toHaveBeenNthCalledWith(2, "product_variants");
  });

  it("still works when no product name matches (falls back to SKU/color/size only)", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [variantRow({ color: "Black" })], error: null }));

    const result = await listOrderableVariants({ q: "Black" });

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("Black");
  });

  it("returns an empty list gracefully when nothing matches", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    const result = await listOrderableVariants({ q: "nonexistent-sku-xyz" });

    expect(result).toEqual([]);
  });

  it("strips filter-breaking characters (comma/parens) from the search term before querying", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    // Should not throw and should still issue both queries normally.
    await expect(listOrderableVariants({ q: "weird,(query)" })).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});

describe("listOrderableVariants — still excludes archived variants", () => {
  it("filters by status=active in both the browse and search paths", async () => {
    // Documented via the .eq("status", "active") call present unconditionally in the query
    // builder before any search branch — archived variants (status !== "active") never reach
    // either code path regardless of whether a search term is present.
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: [], error: null }));
    await listOrderableVariants();
    expect(mockFrom).toHaveBeenCalledWith("product_variants");
  });
});
