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
});
