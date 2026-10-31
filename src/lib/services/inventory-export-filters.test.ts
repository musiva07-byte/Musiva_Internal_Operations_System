/**
 * Tests for listInventoryVariantsForExport() (inventory.service.ts) — Stock Management
 * "Print current list" / "Download PDF" / "Download CSV" all read from this. Covers: current
 * filters are applied to the export query, it reads every page up to the cap, and it degrades
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

  /** A table of `total` rows behind an API that returns at most 1,000 per request. */
  function mockPagedVariants(total: number, failOnRequest?: number) {
    let requests = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table !== "product_variants") return emptyChain({ data: [], error: null });
      let range: [number, number] = [0, 999];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (onFulfilled: (v: unknown) => unknown) => {
                requests += 1;
                if (requests === failOnRequest) {
                  return Promise.resolve({ data: null, error: { message: "timeout" } }).then(onFulfilled);
                }
                const end = Math.min(range[1] + 1, range[0] + 1000, total);
                const data = Array.from({ length: Math.max(end - range[0], 0) }, (_, i) => ({
                  id: `v${range[0] + i}`,
                  product_id: "p1",
                  stock_quantity: 1,
                  minimum_stock: 0,
                  selling_price: 1,
                  products: { name: "Dress", sku: "S", categories: null },
                }));
                return Promise.resolve({ data, error: null }).then(onFulfilled);
              };
            }
            return (...args: unknown[]) => {
              if (prop === "range") range = args as [number, number];
              return chain;
            };
          },
        },
      );
      return chain;
    });
    return () => requests;
  }

  it("reads past the API's 1,000-row response cap, without gaps or repeats", async () => {
    mockPagedVariants(1500);

    const result = await listInventoryVariantsForExport({});

    expect(result.rows).toHaveLength(1500);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(1500);
    expect(result.truncated).toBe(false);
  });

  it("stops at the export limit and says the report is truncated", async () => {
    const requests = mockPagedVariants(5000);

    const result = await listInventoryVariantsForExport({});

    expect(result.rows).toHaveLength(3000);
    expect(result.truncated).toBe(true);
    expect(requests()).toBe(3);
  });

  it("fails the report rather than printing a partial list when a later page fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPagedVariants(1500, 2);

    const result = await listInventoryVariantsForExport({});

    expect(result.rows).toEqual([]);
    expect(result.error).toBeTruthy();
    consoleSpy.mockRestore();
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
