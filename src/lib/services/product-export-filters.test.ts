/**
 * Tests for listProductsForExport() (product.service.ts) — Product Catalog "Print current
 * list" / "Download PDF" / "Download CSV" all read from this. Covers: current-page filters
 * are actually applied to the export query (not just the paginated page), the export scans
 * for every matching row (no .range() pagination), and the safety cap is surfaced via
 * `truncated` rather than silently dropping rows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { listProductsForExport } from "./product.service";

type Call = [string, ...unknown[]];

function captureChain(calls: Call[], result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function emptyChain(result: unknown) {
  return captureChain([], result);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom });
});

describe("listProductsForExport — filters are applied to the query", () => {
  it("applies the search filter as an .or() ilike condition", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return captureChain(calls, { data: [], count: 0, error: null });
      return emptyChain({ data: [], error: null });
    });

    await listProductsForExport({ q: "satin" });

    expect(calls.some(([method, arg]) => method === "or" && String(arg).includes("satin"))).toBe(true);
  });

  it("applies the category filter as .eq('category_id', ...)", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return captureChain(calls, { data: [], count: 0, error: null });
      return emptyChain({ data: [], error: null });
    });

    await listProductsForExport({ categoryId: "cat-123" });

    expect(calls).toContainEqual(["eq", "category_id", "cat-123"]);
  });

  it("applies an explicit status filter as .eq('status', ...) instead of the default active/inactive set", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return captureChain(calls, { data: [], count: 0, error: null });
      return emptyChain({ data: [], error: null });
    });

    await listProductsForExport({ status: "archived" });

    expect(calls).toContainEqual(["eq", "status", "archived"]);
  });

  it("never applies .range() (paginates) — it scans up to the export limit instead", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return captureChain(calls, { data: [], count: 0, error: null });
      return emptyChain({ data: [], error: null });
    });

    await listProductsForExport({});

    expect(calls.some(([method]) => method === "range")).toBe(false);
    expect(calls.some(([method]) => method === "limit")).toBe(true);
  });
});

describe("listProductsForExport — website filter (JS-side, post-fetch)", () => {
  function mockTwoProducts() {
    const products = [
      { id: "p1", name: "Published Dress", sku: "P1", slug: "published-dress", status: "active", categories: null, online_status: "published", website_visible: true },
      { id: "p2", name: "Hidden Dress", sku: "P2", slug: "hidden-dress", status: "active", categories: null, online_status: "hidden", website_visible: false },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return emptyChain({ data: products, error: null });
      if (table === "product_variants") return emptyChain({ data: [], error: null });
      if (table === "product_images") return emptyChain({ data: [], error: null });
      return emptyChain({ data: [], error: null });
    });
  }

  it("only returns rows matching the website filter", async () => {
    mockTwoProducts();
    const result = await listProductsForExport({ websiteFilter: "published" });
    expect(result.error).toBeNull();
    expect(result.rows.map((r) => r.id)).toEqual(["p1"]);
  });

  it("returns every row when no website filter is set", async () => {
    mockTwoProducts();
    const result = await listProductsForExport({});
    expect(result.rows.map((r) => r.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("listProductsForExport — truncation safety", () => {
  it("flags truncated when the row count hits the export cap", async () => {
    const EXPORT_ROW_LIMIT = 2000;
    const products = Array.from({ length: EXPORT_ROW_LIMIT }, (_, i) => ({
      id: `p${i}`,
      name: `Product ${i}`,
      sku: `SKU${i}`,
      slug: `product-${i}`,
      status: "active",
      categories: null,
      online_status: "hidden",
      website_visible: false,
    }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return emptyChain({ data: products, error: null });
      return emptyChain({ data: [], error: null });
    });

    const result = await listProductsForExport({});
    expect(result.truncated).toBe(true);
  });

  it("does not flag truncated for a normal-sized result", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return emptyChain({
          data: [{ id: "p1", name: "A", sku: "A", slug: "a", status: "active", categories: null, online_status: "hidden", website_visible: false }],
          error: null,
        });
      }
      return emptyChain({ data: [], error: null });
    });

    const result = await listProductsForExport({});
    expect(result.truncated).toBe(false);
  });
});

describe("listProductsForExport — error handling", () => {
  it("returns a friendly error and logs server-side when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return emptyChain({ data: null, error: { message: "connection refused" } });
      return emptyChain({ data: [], error: null });
    });

    const result = await listProductsForExport({});
    expect(result.rows).toEqual([]);
    expect(result.error).toBe("Unable to load data. Please try again or contact the administrator.");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
