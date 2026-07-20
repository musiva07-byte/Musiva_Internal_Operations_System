/**
 * Tests for listProducts()'s per-product cost_summary (Product Catalog "View cost").
 *
 * Uses the same centralized getValidBuyingCost rule as the dashboard and product detail
 * page — a variant only contributes to totals when both its INR price and exchange rate
 * are present and positive; missing/invalid ones are counted separately, never summed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { listProducts } from "./product.service";

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

const productRow = {
  id: "product-1",
  name: "Satin Dress",
  sku: "MSV-10001",
  slug: "satin-dress",
  status: "active",
  categories: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom });
});

function mockCatalog(variantRows: unknown[]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return chainResolveAll({ data: [productRow], count: 1, error: null });
    }
    if (table === "product_variants") {
      return chainResolveAll({ data: variantRows, error: null });
    }
    if (table === "product_images") {
      return chainResolveAll({ data: [], error: null });
    }
    return chainResolveAll({ data: [], error: null });
  });
}

describe("listProducts — cost_summary", () => {
  it("counts a variant with valid INR + rate as valid and sums its buying value", async () => {
    mockCatalog([
      {
        id: "v1",
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 11,
        regular_selling_price_bhd: 11,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        latest_additional_landed_cost_bhd: 0,
      },
    ]);

    const result = await listProducts({});
    const product = result.data[0];

    expect(product.cost_summary.validCostCount).toBe(1);
    expect(product.cost_summary.missingCostCount).toBe(0);
    expect(product.cost_summary.totalBuyingValueInr).toBeCloseTo(1500 * 5, 3);
    expect(product.cost_summary.totalFinalCostBhd).toBeCloseTo(6.78 * 5, 3);
    expect(product.cost_summary.totalSellingValueBhd).toBeCloseTo(11 * 5, 3);
    expect(product.cost_summary.variants).toHaveLength(1);
    expect(product.cost_summary.variants[0]).toMatchObject({
      color: "Black",
      size: "M",
      stockQuantity: 5,
      buyingPriceInr: 1500,
      exchangeRateToBhd: 0.00452,
      convertedUnitCostBhd: 6.78,
      additionalLandedCostBhd: 0,
      finalUnitCostBhd: 6.78,
      sellingPriceBhd: 11,
    });
  });

  it("adds the optional additional landed cost on top of the converted price in totals and per-variant rows", async () => {
    mockCatalog([
      {
        id: "v1",
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 11,
        regular_selling_price_bhd: 11,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        latest_additional_landed_cost_bhd: 0.5,
      },
    ]);

    const result = await listProducts({});
    const product = result.data[0];

    // converted = 6.780, final = 6.780 + 0.5 = 7.280
    expect(product.cost_summary.totalFinalCostBhd).toBeCloseTo(7.28 * 5, 3);
    expect(product.cost_summary.variants[0]).toMatchObject({
      convertedUnitCostBhd: 6.78,
      additionalLandedCostBhd: 0.5,
      finalUnitCostBhd: 7.28,
    });
  });

  it("counts a variant missing INR or rate as missing, not valid, and excludes it from totals", async () => {
    mockCatalog([
      {
        id: "v1",
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 11,
        regular_selling_price_bhd: 11,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
      },
    ]);

    const result = await listProducts({});
    const product = result.data[0];

    expect(product.cost_summary.validCostCount).toBe(0);
    expect(product.cost_summary.missingCostCount).toBe(1);
    expect(product.cost_summary.totalBuyingValueInr).toBe(0);
    expect(product.cost_summary.totalFinalCostBhd).toBe(0);
    expect(product.cost_summary.totalSellingValueBhd).toBe(0);
    expect(product.cost_summary.variants[0]).toMatchObject({
      buyingPriceInr: null,
      exchangeRateToBhd: null,
      convertedUnitCostBhd: null,
      additionalLandedCostBhd: null,
      finalUnitCostBhd: null,
    });
  });

  it("computes the selling price range across variants", async () => {
    mockCatalog([
      {
        id: "v1",
        product_id: "product-1",
        color: "Black",
        size: "S",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 9,
        regular_selling_price_bhd: 9,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
      },
      {
        id: "v2",
        product_id: "product-1",
        color: "Black",
        size: "L",
        stock_quantity: 3,
        minimum_stock: 1,
        selling_price: 13,
        regular_selling_price_bhd: 13,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
      },
    ]);

    const result = await listProducts({});
    const product = result.data[0];

    expect(product.min_selling_price).toBe(9);
    expect(product.max_selling_price).toBe(13);
  });

  it("computes totals from valid-cost variants only when a product has both valid and missing options", async () => {
    mockCatalog([
      {
        id: "v1",
        product_id: "product-1",
        color: "Black",
        size: "S",
        stock_quantity: 5,
        minimum_stock: 1,
        selling_price: 11,
        regular_selling_price_bhd: 11,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
      },
      {
        id: "v2",
        product_id: "product-1",
        color: "Black",
        size: "L",
        stock_quantity: 10,
        minimum_stock: 1,
        selling_price: 20,
        regular_selling_price_bhd: 20,
        discount_price: null,
        discount_price_bhd: null,
        discount_start_at: null,
        discount_end_at: null,
        status: "active",
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
      },
    ]);

    const result = await listProducts({});
    const product = result.data[0];

    // Only the valid v1 (5 units, INR 1500 @ 0.00452) contributes — v2's 10 units at
    // selling price 20 must never be silently folded into the totals.
    expect(product.cost_summary.validCostCount).toBe(1);
    expect(product.cost_summary.missingCostCount).toBe(1);
    expect(product.cost_summary.totalBuyingValueInr).toBeCloseTo(1500 * 5, 3);
    expect(product.cost_summary.totalFinalCostBhd).toBeCloseTo(6.78 * 5, 3);
    expect(product.cost_summary.totalSellingValueBhd).toBeCloseTo(11 * 5, 3);
    expect(product.cost_summary.variants).toHaveLength(2);
  });
});
