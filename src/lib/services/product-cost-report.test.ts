/**
 * Tests for getProductCostReport() (owner/manager/accountant-only /admin/reports/product-costs).
 *
 * Same validity rule as the dashboard and product detail pages: only variants with both a
 * valid INR price and exchange rate contribute to totals; missing ones are counted, never
 * assumed to be 0 or silently merged into the totals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { getProductCostReport } from "./report.service";

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

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom });
});

describe("getProductCostReport", () => {
  it("returns an empty array when Supabase is not configured", async () => {
    mockCreateClient.mockResolvedValue(null);
    const result = await getProductCostReport();
    expect(result).toEqual([]);
  });

  it("aggregates one row per product from its valid-cost variants only", async () => {
    mockFrom.mockReturnValue(
      chainResolveAll({
        data: [
          {
            product_id: "product-1",
            stock_quantity: 5,
            latest_supplier_unit_cost_inr: 1500,
            latest_exchange_rate_to_bhd: 0.00452,
            regular_selling_price_bhd: 11,
            selling_price: 11,
            status: "active",
            products: { name: "Satin Dress", categories: { name: "Dresses" } },
          },
          {
            product_id: "product-1",
            stock_quantity: 10,
            latest_supplier_unit_cost_inr: null,
            latest_exchange_rate_to_bhd: null,
            regular_selling_price_bhd: 20,
            selling_price: 20,
            status: "active",
            products: { name: "Satin Dress", categories: { name: "Dresses" } },
          },
        ],
        error: null,
      }),
    );

    const result = await getProductCostReport();
    expect(result).toHaveLength(1);
    const row = result[0];

    expect(row.productName).toBe("Satin Dress");
    expect(row.categoryName).toBe("Dresses");
    expect(row.totalStock).toBe(15);
    expect(row.validCostCount).toBe(1);
    expect(row.missingCostCount).toBe(1);
    expect(row.totalBuyingValueInr).toBeCloseTo(1500 * 5, 3);
    expect(row.totalBuyingValueBhd).toBeCloseTo(6.78 * 5, 3);
    expect(row.estimatedSellingValueBhd).toBeCloseTo(11 * 5, 3);
    expect(row.estimatedGrossProfitBhd).toBeCloseTo(11 * 5 - 6.78 * 5, 3);
    expect(row.estimatedMarginPercent).not.toBeNull();
  });

  it("returns null margin and zero-value totals when no variant has a valid cost", async () => {
    mockFrom.mockReturnValue(
      chainResolveAll({
        data: [
          {
            product_id: "product-2",
            stock_quantity: 3,
            latest_supplier_unit_cost_inr: null,
            latest_exchange_rate_to_bhd: null,
            regular_selling_price_bhd: 9,
            selling_price: 9,
            status: "active",
            products: { name: "Linen Top", categories: null },
          },
        ],
        error: null,
      }),
    );

    const result = await getProductCostReport();
    const row = result[0];

    expect(row.validCostCount).toBe(0);
    expect(row.missingCostCount).toBe(1);
    expect(row.totalBuyingValueBhd).toBe(0);
    expect(row.estimatedSellingValueBhd).toBe(0);
    expect(row.estimatedMarginPercent).toBeNull();
    expect(row.categoryName).toBeNull();
  });

  it("never leaks a corrupted legacy landed-cost figure — the query never selects that column", async () => {
    mockFrom.mockReturnValue(
      chainResolveAll({
        data: [
          {
            product_id: "product-3",
            stock_quantity: 5,
            latest_supplier_unit_cost_inr: 1500,
            latest_exchange_rate_to_bhd: 0.00452,
            // Even if a stray legacy field were present on the row, the report only reads
            // latest_supplier_unit_cost_inr / latest_exchange_rate_to_bhd.
            latest_landed_cost_bhd: 6012099.002,
            regular_selling_price_bhd: 11,
            selling_price: 11,
            status: "active",
            products: { name: "Satin Dress", categories: null },
          },
        ],
        error: null,
      }),
    );

    const result = await getProductCostReport();
    expect(result[0].totalBuyingValueBhd).toBeCloseTo(6.78 * 5, 3);
    expect(result[0].totalBuyingValueBhd).toBeLessThan(1000);
  });
});
