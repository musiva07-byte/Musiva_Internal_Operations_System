/**
 * Wiring of the Total Stock / Sold aggregation, and the migration behind it. Classification
 * itself is tested in lib/utils/stock-history.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canViewStockHistory } from "@/lib/auth/permissions";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ rpc: mockRpc }),
}));

import { getVariantStockSummaries } from "./inventory.service";

const migration = readFileSync(
  join(process.cwd(), "database/migrations/202610310001_variant_stock_movement_groups.sql"),
  "utf-8",
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getVariantStockSummaries", () => {
  it("summarizes the groups the database returns", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { variant_id: "v1", movement_type: "opening_stock", order_cancelled: false, balance_change: 10 },
        { variant_id: "v1", movement_type: "sale_deduction", order_cancelled: false, balance_change: -7 },
      ],
      error: null,
    });

    const result = await getVariantStockSummaries([{ id: "v1", stock_quantity: 3 }]);

    expect(mockRpc).toHaveBeenCalledWith("get_variant_stock_movement_groups", { p_variant_ids: ["v1"] });
    expect(result?.get("v1")).toMatchObject({ total_stock_quantity: 10, net_sold_quantity: 7, current_stock_quantity: 3 });
  });

  it("returns null, not zeros, when the function is missing or refused", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });

    expect(await getVariantStockSummaries([{ id: "v1", stock_quantity: 3 }])).toBeNull();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("get_variant_stock_movement_groups"),
      expect.objectContaining({ code: "PGRST202", message: "Could not find the function", variantCount: 1 }),
    );
    consoleSpy.mockRestore();
  });

  it("treats an unexpected response as a failure, not as no history", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await getVariantStockSummaries([{ id: "v1", stock_quantity: 3 }])).toBeNull();
    consoleSpy.mockRestore();
  });

  it("handles a history far beyond a 1,000-row response", async () => {
    const variants = Array.from({ length: 3000 }, (_, i) => ({ id: `v${i}`, stock_quantity: 3 }));
    mockRpc.mockResolvedValue({
      data: variants.flatMap(({ id }) => [
        { variant_id: id, movement_type: "opening_stock", order_cancelled: false, balance_change: 10 },
        { variant_id: id, movement_type: "sale_deduction", order_cancelled: false, balance_change: -7 },
      ]),
      error: null,
    });

    const result = await getVariantStockSummaries(variants);

    expect(result?.size).toBe(3000);
    expect(result?.get("v2999")).toMatchObject({ history_status: "complete", total_stock_quantity: 10, net_sold_quantity: 7 });
  });

  it("skips the database when there is nothing to summarize", async () => {
    expect(await getVariantStockSummaries([])).toEqual(new Map());
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("get_variant_stock_movement_groups migration", () => {
  it("is read-only: no writes to any table", () => {
    expect(migration).not.toMatch(/^\s*(insert|update|delete|truncate|alter table|drop table)\b/im);
    expect(migration).toMatch(/\bstable\b/);
  });

  it("measures real balance change, so a damaged return counts as nothing", () => {
    expect(migration).toContain("sum(m.new_quantity - m.previous_quantity)");
  });

  it("matches cancelled orders for sale, correction and rollback movements", () => {
    for (const type of ["'order'", "'order_item_correction'", "'order_item_correction_rollback'"]) {
      expect(migration).toContain(type);
    }
  });

  it("checks the role server-side, and allows the same roles as canViewStockHistory", () => {
    expect(migration).toContain("perform assert_staff_role(");
    for (const role of ["owner", "manager", "inventory_staff", "accountant"]) {
      expect(migration).toContain(`'${role}'::staff_role`);
      expect(canViewStockHistory(role as never)).toBe(true);
    }
    for (const role of ["sales_staff", "delivery_coordinator"]) {
      expect(migration).not.toContain(`'${role}'::staff_role`);
      expect(canViewStockHistory(role as never)).toBe(false);
    }
  });

  it("returns one value rather than rows, so the API's row cap can't shorten it", () => {
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("jsonb_agg");
  });

  it("refreshes the API's function cache when applied", () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("is not callable without signing in", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
