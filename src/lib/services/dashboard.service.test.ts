/**
 * Tests for dashboard.service.ts
 *
 * Verifies data transformation logic, stock filtering, best-seller aggregation,
 * chart bucketing, and the failed/pending delivery distinction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

// vi.hoisted ensures these values exist before the vi.mock factory runs (which
// is hoisted to the top of the file regardless of where it appears in source).
const { mockFrom, mockRpc, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { getDashboardData } from "./dashboard.service";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates a fluent Supabase query stub that resolves to `result` when awaited.
 * Any method call on the stub returns itself for unlimited chaining.
 */
function chainResolveAll(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
      },
    }
  );
  return proxy;
}

const emptyQuery = () => chainResolveAll({ data: [], count: 0, error: null });

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  // Default: RPC returns zero stock counts
  mockRpc.mockReturnValue(chainResolveAll({ data: { low_stock_count: 0, out_of_stock_count: 0 }, error: null }));
  // Default: valid Supabase client with from() and rpc()
  mockCreateClient.mockResolvedValue({ from: mockFrom, rpc: mockRpc });
  // Default: all table queries return empty/zero — individual tests override per-table
  mockFrom.mockReturnValue(emptyQuery());
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getDashboardData", () => {
  // ── 1. Null client ───────────────────────────────────────────────────────

  it("returns zero/empty dashboard when supabase client is unavailable", async () => {
    mockCreateClient.mockResolvedValue(null);

    const result = await getDashboardData();

    expect(result.todaySales).toBe(0);
    expect(result.monthSales).toBe(0);
    expect(result.ordersToday).toBe(0);
    expect(result.pendingDeliveries).toBe(0);
    expect(result.failedDeliveries).toBe(0);
    expect(result.lowStockProducts).toBe(0);
    expect(result.outOfStockProducts).toBe(0);
    expect(result.recentOrders).toHaveLength(0);
    expect(result.bestSellers).toHaveLength(0);
    expect(result.salesChart).toHaveLength(0);
    expect(result.paymentSummary).toHaveLength(0);
    expect(result.deliverySummary).toHaveLength(0);
  });

  // ── 2. Return shape ──────────────────────────────────────────────────────

  it("returns the correct shape with all required keys", async () => {
    const result = await getDashboardData();

    expect(result).toHaveProperty("todaySales");
    expect(result).toHaveProperty("monthSales");
    expect(result).toHaveProperty("ordersToday");
    expect(result).toHaveProperty("pendingDeliveries");
    expect(result).toHaveProperty("failedDeliveries");
    expect(result).toHaveProperty("lowStockProducts");
    expect(result).toHaveProperty("outOfStockProducts");
    expect(result).toHaveProperty("recentOrders");
    expect(result).toHaveProperty("bestSellers");
    expect(result).toHaveProperty("salesChart");
    expect(result).toHaveProperty("paymentSummary");
    expect(result).toHaveProperty("deliverySummary");
  });

  it("all numeric fields default to 0 when no data exists", async () => {
    const result = await getDashboardData();

    expect(result.todaySales).toBe(0);
    expect(result.monthSales).toBe(0);
    expect(result.ordersToday).toBe(0);
    expect(result.pendingDeliveries).toBe(0);
    expect(result.failedDeliveries).toBe(0);
    expect(result.lowStockProducts).toBe(0);
    expect(result.outOfStockProducts).toBe(0);
  });

  // ── 3. Stock counts ───────────────────────────────────────────────────────

  it("correctly counts out-of-stock and low-stock from RPC result", async () => {
    mockRpc.mockReturnValue(
      chainResolveAll({ data: { low_stock_count: 1, out_of_stock_count: 2 }, error: null })
    );

    const result = await getDashboardData();
    expect(result.outOfStockProducts).toBe(2);
    expect(result.lowStockProducts).toBe(1);
  });

  it("counts zero low/out-of-stock when RPC returns zeros", async () => {
    // Default mockRpc already returns 0,0 — no override needed
    const result = await getDashboardData();
    expect(result.outOfStockProducts).toBe(0);
    expect(result.lowStockProducts).toBe(0);
  });

  it("reads low-stock count directly from RPC result", async () => {
    mockRpc.mockReturnValue(
      chainResolveAll({ data: { low_stock_count: 1, out_of_stock_count: 0 }, error: null })
    );

    const result = await getDashboardData();
    expect(result.lowStockProducts).toBe(1);
    expect(result.outOfStockProducts).toBe(0);
  });

  it("handles null RPC data gracefully and defaults stock counts to 0", async () => {
    mockRpc.mockReturnValue(
      chainResolveAll({ data: null, error: { message: "RPC error" } })
    );

    const result = await getDashboardData();
    expect(result.lowStockProducts).toBe(0);
    expect(result.outOfStockProducts).toBe(0);
  });

  // ── 4. Best-seller aggregation ────────────────────────────────────────────

  it("aggregates best sellers by product name and ranks by quantity", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "order_items") {
        return chainResolveAll({
          data: [
            { product_name_snapshot: "Satin Dress", quantity: 3, line_total: "36.000", orders: { order_status: "completed" } },
            { product_name_snapshot: "Satin Dress", quantity: 2, line_total: "24.000", orders: { order_status: "new" } },
            { product_name_snapshot: "Linen Abaya", quantity: 10, line_total: "250.000", orders: { order_status: "delivered" } },
            { product_name_snapshot: "Silk Top",    quantity: 1, line_total: "15.500", orders: { order_status: "confirmed" } },
          ],
          error: null,
        });
      }
      return emptyQuery();
    });

    const result = await getDashboardData();

    expect(result.bestSellers).toHaveLength(3);
    // Ranked by quantity: Linen Abaya (10) > Satin Dress (5) > Silk Top (1)
    expect(result.bestSellers[0].name).toBe("Linen Abaya");
    expect(result.bestSellers[0].quantity).toBe(10);
    expect(result.bestSellers[1].name).toBe("Satin Dress");
    expect(result.bestSellers[1].quantity).toBe(5);
    expect(result.bestSellers[1].revenue).toBeCloseTo(60);
    expect(result.bestSellers[2].name).toBe("Silk Top");
  });

  it("returns at most 5 best sellers", async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      product_name_snapshot: `Product ${i}`,
      quantity: 8 - i,
      line_total: "10.000",
      orders: { order_status: "completed" },
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "order_items") return chainResolveAll({ data: items, error: null });
      return emptyQuery();
    });

    const result = await getDashboardData();
    expect(result.bestSellers).toHaveLength(5);
    // Top entry should be Product 0 (quantity 8)
    expect(result.bestSellers[0].name).toBe("Product 0");
  });

  it("returns empty best sellers when there are no order items", async () => {
    const result = await getDashboardData();
    expect(result.bestSellers).toHaveLength(0);
  });

  // ── 5. Sales totals ───────────────────────────────────────────────────────

  it("sums grand_total correctly for order rows", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return chainResolveAll({
          data: [
            { grand_total: "12.500", payment_status: "paid", created_at: new Date().toISOString() },
            { grand_total: "8.000", payment_status: "unpaid", created_at: new Date().toISOString() },
          ],
          error: null,
        });
      }
      return emptyQuery();
    });

    const result = await getDashboardData();
    // All 3 orders queries return the same 2 rows, so:
    // todaySales = 20.5, monthSales = 20.5 (same mock for all orders queries)
    expect(result.todaySales).toBeCloseTo(20.5, 3);
    expect(result.monthSales).toBeCloseTo(20.5, 3);
    expect(result.ordersToday).toBe(2);
  });

  // ── 6. 7-day chart ─────────────────────────────────────────────────────────

  it("always returns exactly 7 chart data points", async () => {
    const result = await getDashboardData();
    expect(result.salesChart).toHaveLength(7);
  });

  it("chart labels are 3-letter weekday names", async () => {
    const result = await getDashboardData();
    const validDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    result.salesChart.forEach((day) => {
      expect(validDays).toContain(day.label);
    });
  });

  it("chart totals are 0 when there are no sales", async () => {
    const result = await getDashboardData();
    result.salesChart.forEach((day) => {
      expect(day.total).toBe(0);
    });
  });

  // ── 7. Payment summary ────────────────────────────────────────────────────

  it("groups orders by payment status for the month", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return chainResolveAll({
          data: [
            { grand_total: "10.000", payment_status: "paid",   created_at: new Date().toISOString() },
            { grand_total: "10.000", payment_status: "paid",   created_at: new Date().toISOString() },
            { grand_total: "10.000", payment_status: "unpaid", created_at: new Date().toISOString() },
            { grand_total: "10.000", payment_status: "cod",    created_at: new Date().toISOString() },
          ],
          error: null,
        });
      }
      return emptyQuery();
    });

    const result = await getDashboardData();
    const paidEntry   = result.paymentSummary.find((e) => e.status === "paid");
    const unpaidEntry = result.paymentSummary.find((e) => e.status === "unpaid");
    const codEntry    = result.paymentSummary.find((e) => e.status === "cod");

    expect(paidEntry?.count).toBe(2);
    expect(unpaidEntry?.count).toBe(1);
    expect(codEntry?.count).toBe(1);
  });

  // ── 8. Failed deliveries count ────────────────────────────────────────────

  it("exposes failedDeliveries separately from pendingDeliveries", async () => {
    let deliveryCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "deliveries") {
        deliveryCallCount++;
        if (deliveryCallCount === 1) {
          // First call: .in("delivery_status", ACTIVE_DELIVERY_STATUSES) → pending count
          return chainResolveAll({ count: 7, data: null, error: null });
        }
        if (deliveryCallCount === 2) {
          // Second call: .eq("delivery_status", "failed") → failed count
          return chainResolveAll({ count: 3, data: null, error: null });
        }
        // Remaining calls: getDeliverySummary per-status queries
        return chainResolveAll({ count: 0, data: null, error: null });
      }
      return emptyQuery();
    });

    const result = await getDashboardData();
    expect(result.pendingDeliveries).toBe(7);
    expect(result.failedDeliveries).toBe(3);
  });

  // ── 9. Delivery summary — only non-zero statuses ──────────────────────────

  it("delivery summary excludes statuses with zero count", async () => {
    // All deliveries return count: 0 → summary should be empty
    const result = await getDashboardData();
    expect(result.deliverySummary).toHaveLength(0);
  });

  // ── 10. Query filter verification ─────────────────────────────────────────

  it("applies NOT IN filter to exclude cancelled/returned orders from sales", async () => {
    const notCalls: Array<{ table: string; col: string; op: string; val: string }> = [];

    mockFrom.mockImplementation((table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proxy: any = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "not") {
              return (col: string, op: string, val: string) => {
                notCalls.push({ table, col, op, val });
                return proxy;
              };
            }
            if (prop === "then") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (onFulfilled: any) =>
                Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
          },
        }
      );
      return proxy;
    });

    await getDashboardData();

    const orderNotFilters = notCalls.filter(
      ({ table, col, op }) =>
        table === "orders" && col === "order_status" && op === "in"
    );
    expect(orderNotFilters.length).toBeGreaterThan(0);
    orderNotFilters.forEach(({ val }) => {
      expect(val).toContain("cancelled");
      expect(val).toContain("returned");
    });
  });

  it("filters order_items by excluding cancelled/returned via joined orders table", async () => {
    const neqCalls: Array<{ table: string; col: string; val: string }> = [];

    mockFrom.mockImplementation((table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proxy: any = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "neq") {
              return (col: string, val: string) => {
                neqCalls.push({ table, col, val });
                return proxy;
              };
            }
            if (prop === "then") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (onFulfilled: any) =>
                Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
          },
        }
      );
      return proxy;
    });

    await getDashboardData();

    const itemFilters = neqCalls.filter(
      ({ table, col }) => table === "order_items" && col === "orders.order_status"
    );
    const filteredStatuses = itemFilters.map(({ val }) => val);
    expect(filteredStatuses).toContain("cancelled");
    expect(filteredStatuses).toContain("returned");
  });

  it("uses the stock-alert RPC to exclude archived variants at DB level", async () => {
    await getDashboardData();
    expect(mockRpc).toHaveBeenCalledWith("get_stock_alert_counts");
  });

  // ── Website requests (Unit 2F) ────────────────────────────────────────────

  it("computes new/contacted website request counts and latest request time from real data", async () => {
    let wsCall = 0;
    const wsResults = [
      { count: 4, error: null }, // new
      { count: 2, error: null }, // contacted
      { data: { created_at: "2026-07-16T22:13:31.489157+00:00" }, error: null }, // latest
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === "website_order_requests") {
        return chainResolveAll(wsResults[wsCall++]);
      }
      return emptyQuery();
    });

    const result = await getDashboardData();

    expect(result.newWebsiteRequests).toBe(4);
    expect(result.contactedWebsiteRequests).toBe(2);
    expect(result.latestWebsiteRequestAt).toBe("2026-07-16T22:13:31.489157+00:00");
  });

  it("defaults website request fields to zero/null when none exist", async () => {
    const result = await getDashboardData();
    expect(result.newWebsiteRequests).toBe(0);
    expect(result.contactedWebsiteRequests).toBe(0);
    expect(result.latestWebsiteRequestAt).toBeNull();
  });

  it("returns zero/null website request fields when Supabase is unavailable", async () => {
    mockCreateClient.mockResolvedValue(null);
    const result = await getDashboardData();
    expect(result.newWebsiteRequests).toBe(0);
    expect(result.contactedWebsiteRequests).toBe(0);
    expect(result.latestWebsiteRequestAt).toBeNull();
  });

  // ── Product Cost Summary — buying-cost validity bug fix ─────────────────────
  // Regression coverage for the "impossible dashboard values" bug: totals were being
  // summed from latest_landed_cost_bhd/average_landed_cost_bhd, which are also written
  // by the unrelated Purchase Order flow and can carry bad legacy data. The fix reads
  // only latest_supplier_unit_cost_inr/latest_exchange_rate_to_bhd and always recalculates
  // buying price BHD fresh — see getValidBuyingCost in lib/utils/cost-conversion.ts.

  function mockProductVariantsAndRate(rows: unknown[], rate: number | null = 0.00452) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return chainResolveAll({ data: rows, error: null });
      }
      if (table === "exchange_rates") {
        return chainResolveAll({ data: rate !== null ? { rate } : null, error: null });
      }
      return emptyQuery();
    });
  }

  it("excludes a variant with a missing INR price from totals and counts it as missing", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.validBuyingCostCount).toBe(0);
    expect(result.missingCostVariantCount).toBe(1);
    expect(result.totalBuyingValueInr).toBe(0);
    expect(result.totalFinalCostBhd).toBe(0);
  });

  it("excludes a variant with a missing exchange rate from totals and counts it as missing", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.validBuyingCostCount).toBe(0);
    expect(result.missingCostVariantCount).toBe(1);
    expect(result.totalFinalCostBhd).toBe(0);
  });

  it("computes total buying value INR/BHD from valid INR × rate × quantity only", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.validBuyingCostCount).toBe(1);
    expect(result.missingCostVariantCount).toBe(0);
    expect(result.totalBuyingValueInr).toBeCloseTo(1500 * 5, 3);
    expect(result.totalFinalCostBhd).toBeCloseTo(6.78 * 5, 3);
  });

  it("uses the final buying cost (converted + optional additional landed cost) for totals", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        latest_additional_landed_cost_bhd: 0.5,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    // converted = 6.780, final = 6.780 + 0.5 = 7.280
    expect(result.totalFinalCostBhd).toBeCloseTo(7.28 * 5, 3);
  });

  it("never leaks a corrupted legacy landed-cost column into totals — that column is not even queried", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        // Simulates the exact bug: a huge stray BHD figure from the purchase-order flow.
        // The service no longer selects this column at all, so it cannot leak even if present.
        latest_landed_cost_bhd: 6012099.002,
        average_landed_cost_bhd: 6012099.002,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.totalFinalCostBhd).toBeCloseTo(6.78 * 5, 3);
    expect(result.totalFinalCostBhd).toBeLessThan(1000);
  });

  it("calculates estimated selling value as selling price × quantity, valid-cost variants only", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
      {
        product_id: "product-2",
        color: "Beige",
        size: "S",
        stock_quantity: 100,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 999,
        selling_price: 999,
        products: { name: "Linen Top" },
      },
    ]);

    const result = await getDashboardData();
    // Only the valid-cost variant (11 × 5 = 55) contributes; the missing-cost variant's
    // huge selling value (999 × 100) must never be folded in.
    expect(result.estimatedSellingValueBhd).toBeCloseTo(11 * 5, 3);
  });

  it("calculates gross profit as selling value minus final cost", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    // selling value = 55.000, final cost = 33.900 (6.78 × 5) → profit = 21.100
    expect(result.estimatedSellingValueBhd).toBeCloseTo(55, 3);
    expect(result.totalFinalCostBhd).toBeCloseTo(33.9, 3);
    expect(result.estimatedGrossProfitBhd).toBeCloseTo(21.1, 3);
  });

  it("does not divide by zero when a valid-cost variant has no selling price recorded", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 0,
        selling_price: 0,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.validBuyingCostCount).toBe(1);
    expect(result.estimatedSellingValueBhd).toBe(0);
    expect(result.estimatedMarginPercent).toBeNull();
    expect(Number.isFinite(result.estimatedGrossProfitBhd)).toBe(true);
  });

  it("low-margin list only ever includes variants with a valid buying cost", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        // Selling price barely above final cost (6.78) → low margin, valid cost.
        regular_selling_price_bhd: 7,
        selling_price: 7,
        products: { name: "Satin Dress" },
      },
      {
        product_id: "product-2",
        color: "Beige",
        size: "S",
        stock_quantity: 5,
        // Missing cost — even though selling price is very low, this must never appear
        // as a "low margin" item since margin can't be computed without a valid cost.
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 1,
        selling_price: 1,
        products: { name: "Linen Top" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.lowMarginVariants.length).toBe(1);
    expect(result.lowMarginVariants[0].name).toContain("Satin Dress");
  });

  it("never shows an impossible negative gross profit or margin for reasonable valid costs", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.estimatedGrossProfitBhd).toBeGreaterThan(-100);
    expect(result.estimatedMarginPercent).not.toBeNull();
    expect(result.estimatedMarginPercent!).toBeGreaterThan(-1000);
  });

  it("shows zero/null profit fields (not impossible values) when no valid buying cost exists at all", async () => {
    mockProductVariantsAndRate([
      {
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.validBuyingCostCount).toBe(0);
    expect(result.estimatedSellingValueBhd).toBe(0);
    expect(result.estimatedGrossProfitBhd).toBe(0);
    expect(result.estimatedMarginPercent).toBeNull();
  });

  it("shows the latest exchange rate when a default is set", async () => {
    mockProductVariantsAndRate([], 0.00452);
    const result = await getDashboardData();
    expect(result.latestExchangeRate).toBe(0.00452);
  });

  it("shows null (rendered as 'Not set') when no default exchange rate exists", async () => {
    mockProductVariantsAndRate([], null);
    const result = await getDashboardData();
    expect(result.latestExchangeRate).toBeNull();
  });

  // ── Business Stock Value — total units, per-product breakdown ──────────────

  it("counts total stock units across all variants, regardless of cost validity", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
      {
        product_id: "product-2",
        color: "Beige",
        size: "S",
        stock_quantity: 9,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 20,
        selling_price: 20,
        products: { name: "Linen Top" },
      },
    ]);

    const result = await getDashboardData();
    // 5 (valid cost) + 9 (missing cost) = 14 — missing-cost stock still counts as real stock.
    expect(result.totalStockUnits).toBe(14);
  });

  it("returns an empty product cost breakdown when no product has a valid cost", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-2",
        color: "Beige",
        size: "S",
        stock_quantity: 9,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 20,
        selling_price: 20,
        products: { name: "Linen Top" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.productCostBreakdown).toHaveLength(0);
  });

  it("aggregates the product cost breakdown per product and ranks by final stock cost", async () => {
    mockProductVariantsAndRate([
      {
        product_id: "product-1",
        color: "Black",
        size: "M",
        stock_quantity: 5,
        latest_supplier_unit_cost_inr: 1500,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
      {
        product_id: "product-1",
        color: "Black",
        size: "L",
        // Missing cost — should count toward this product's missingCostCount but not its totals.
        stock_quantity: 2,
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        regular_selling_price_bhd: 11,
        selling_price: 11,
        products: { name: "Satin Dress" },
      },
      {
        product_id: "product-2",
        color: "Beige",
        size: "S",
        stock_quantity: 20,
        latest_supplier_unit_cost_inr: 3000,
        latest_exchange_rate_to_bhd: 0.00452,
        regular_selling_price_bhd: 25,
        selling_price: 25,
        products: { name: "Linen Abaya" },
      },
    ]);

    const result = await getDashboardData();
    expect(result.productCostBreakdown).toHaveLength(2);

    // Linen Abaya: final = 3000×0.00452=13.56, ×20 units = 271.2 → ranked first.
    expect(result.productCostBreakdown[0].productName).toBe("Linen Abaya");
    expect(result.productCostBreakdown[0].totalStock).toBe(20);
    expect(result.productCostBreakdown[0].totalFinalCostBhd).toBeCloseTo(13.56 * 20, 2);
    expect(result.productCostBreakdown[0].missingCostCount).toBe(0);

    // Satin Dress: only the M variant (5 units) has a valid cost; L (2 units) is missing.
    const satin = result.productCostBreakdown[1];
    expect(satin.productName).toBe("Satin Dress");
    expect(satin.totalStock).toBe(7); // both variants' stock counts toward total units
    expect(satin.totalFinalCostBhd).toBeCloseTo(6.78 * 5, 3);
    expect(satin.missingCostCount).toBe(1);
  });
});
