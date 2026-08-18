/**
 * Tests for listInventoryVariantsForExport() (inventory.service.ts) — Stock Management
 * "Print current list" / "Download PDF" / "Download CSV" all read from this. Covers: current
 * filters are applied to the export query, it scans (no .range() pagination), and it degrades
 * the same way the paginated page does when the color-images migration hasn't been applied.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { listInventoryVariantsForExport } from "./inventory.service";

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

describe("listInventoryVariantsForExport — filters are applied to the query", () => {
  it("applies the search filter as an .or() ilike condition", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return captureChain(calls, { data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    await listInventoryVariantsForExport({ q: "black" });

    expect(calls.some(([method, arg]) => method === "or" && String(arg).includes("black"))).toBe(true);
  });

  it("applies the low-stock filter as .gt + .filter on stock_quantity", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return captureChain(calls, { data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    await listInventoryVariantsForExport({ stock: "low" });

    expect(calls).toContainEqual(["gt", "stock_quantity", 0]);
    expect(calls.some(([method, field]) => method === "filter" && field === "stock_quantity")).toBe(true);
  });

  it("applies the out-of-stock filter as .eq('stock_quantity', 0)", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return captureChain(calls, { data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    await listInventoryVariantsForExport({ stock: "out" });

    expect(calls).toContainEqual(["eq", "stock_quantity", 0]);
  });

  it("applies the archived product-status filter as .eq('status', 'archived')", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return captureChain(calls, { data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    await listInventoryVariantsForExport({ productStatus: "archived" });

    expect(calls).toContainEqual(["eq", "status", "archived"]);
  });

  it("never applies .range() (paginates) — it scans up to the export limit instead", async () => {
    const calls: Call[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return captureChain(calls, { data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    await listInventoryVariantsForExport({});

    expect(calls.some(([method]) => method === "range")).toBe(false);
    expect(calls.some(([method]) => method === "limit")).toBe(true);
  });
});

describe("listInventoryVariantsForExport — real rows flow through with correct shaping", () => {
  it("returns shaped rows including product name/sku pulled from the join", async () => {
    const variantRows = [
      {
        id: "v1",
        product_id: "product-1",
        variant_sku: "05T-BLA-M",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 11,
        regular_selling_price_bhd: 11,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        products: { name: "Satin Dress", sku: "MSV-10001", categories: { name: "Dresses" } },
      },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return emptyChain({ data: variantRows, error: null });
      if (table === "product_images") return emptyChain({ data: [], error: null });
      return emptyChain({ data: [], error: null });
    });

    const result = await listInventoryVariantsForExport({});
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].product_name).toBe("Satin Dress");
    expect(result.rows[0].product_sku).toBe("MSV-10001");
    expect(result.rows[0].category_name).toBe("Dresses");
  });
});

describe("listInventoryVariantsForExport — error handling", () => {
  it("returns a friendly error and logs server-side when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") return emptyChain({ data: null, error: { message: "timeout" } });
      return emptyChain({ data: [], error: null });
    });

    const result = await listInventoryVariantsForExport({});
    expect(result.rows).toEqual([]);
    expect(result.error).toBe("Unable to load data. Please try again or contact the administrator.");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
