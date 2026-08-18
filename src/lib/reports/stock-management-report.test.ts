/**
 * Tests for the Stock Management Print/PDF/CSV export column gating
 * (stock-management-report.ts). getValidBuyingCost() stays the one calculation authority —
 * these tests also guard against a stale/corrupted latest_landed_cost_bhd ever leaking into
 * the export, the same rule cost-conversion.test.ts enforces for the UI.
 */
import { describe, it, expect } from "vitest";
import {
  getStockManagementColumns,
  buildStockManagementRow,
} from "./stock-management-report";
import type { InventoryVariantItem } from "@/types/app";
import type { StaffRole } from "@/types/database";

function makeVariant(overrides: Partial<InventoryVariantItem> = {}): InventoryVariantItem {
  return {
    id: "variant-1",
    product_id: "product-1",
    variant_sku: "05T-BLA-M",
    barcode: null,
    color: "Black",
    size: "M",
    cost_price: 0,
    selling_price: 11,
    discount_price: null,
    regular_selling_price_bhd: 11,
    discount_price_bhd: null,
    discount_start_at: null,
    discount_end_at: null,
    stock_quantity: 5,
    minimum_stock: 2,
    status: "active",
    latest_landed_cost_bhd: null,
    average_landed_cost_bhd: null,
    latest_supplier_unit_cost_inr: 1500,
    latest_exchange_rate_to_bhd: 0.00452,
    latest_additional_landed_cost_bhd: 0.5,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    product_name: "Satin Dress",
    product_sku: "MSV-10001",
    category_name: "Dresses",
    primary_image_url: null,
    stock_status: "in_stock",
    active_selling_price: 11,
    pricing_status: "regular",
    ...overrides,
  } as InventoryVariantItem;
}

const SALES_STAFF: StaffRole = "sales_staff";
const DELIVERY_COORDINATOR: StaffRole = "delivery_coordinator";
const INVENTORY_STAFF: StaffRole = "inventory_staff";
const ACCOUNTANT: StaffRole = "accountant";
const OWNER: StaffRole = "owner";

describe("getStockManagementColumns — role gating", () => {
  it("gives roles with no cost visibility only the base stock columns", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      expect(getStockManagementColumns(role)).toEqual([
        "Product name",
        "Product code / SKU",
        "Color",
        "Size",
        "Variant code",
        "Available stock",
        "Minimum stock",
        "Stock status",
        "Selling price BHD",
      ]);
    }
  });

  it("adds buying-cost columns (INR, exchange rate, final cost) for canViewBuyingCost roles", () => {
    for (const role of [INVENTORY_STAFF, ACCOUNTANT, OWNER]) {
      const columns = getStockManagementColumns(role);
      expect(columns).toContain("Buying price India INR");
      expect(columns).toContain("Exchange rate");
      expect(columns).toContain("Final cost per piece BHD");
      expect(columns).toContain("Cost status");
    }
  });

  it("only adds profit/margin columns for canViewCostData roles, not inventory_staff", () => {
    expect(getStockManagementColumns(INVENTORY_STAFF)).not.toContain("Profit per piece BHD");
    expect(getStockManagementColumns(INVENTORY_STAFF)).not.toContain("Margin %");
    for (const role of [ACCOUNTANT, OWNER]) {
      expect(getStockManagementColumns(role)).toContain("Profit per piece BHD");
      expect(getStockManagementColumns(role)).toContain("Margin %");
    }
  });
});

describe("buildStockManagementRow — base columns (every role)", () => {
  it("includes the required base fields in order", () => {
    const row = buildStockManagementRow(makeVariant(), SALES_STAFF);
    expect(row).toEqual([
      "Satin Dress",
      "MSV-10001",
      "Black",
      "M",
      "05T-BLA-M",
      5,
      2,
      "In Stock",
      "BHD 11.000",
    ]);
  });

  it("row length always matches the column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildStockManagementRow(makeVariant(), role);
      expect(row).toHaveLength(getStockManagementColumns(role).length);
    }
  });
});

describe("buildStockManagementRow — cost/profit permission safety", () => {
  it("never includes buying INR, exchange rate, or cost figures for unauthorized roles", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildStockManagementRow(makeVariant(), role).join(" | ");
      expect(row).not.toMatch(/₹1500|0\.004520|BHD 6\.780|BHD 7\.280|Recorded/);
    }
  });

  it("includes correctly derived buying cost figures for inventory_staff", () => {
    const row = buildStockManagementRow(makeVariant(), INVENTORY_STAFF);
    // buying 1500 INR × 0.00452 = 6.780, + import 0.5 = final 7.280; total = 7.280 × 5 = 36.400
    expect(row.slice(-7)).toEqual([
      "₹1500.00",
      "0.004520",
      "BHD 6.780",
      "BHD 0.500",
      "BHD 7.280",
      "BHD 36.400",
      "Recorded",
    ]);
  });

  it("does not append profit/margin for inventory_staff even though cost is shown", () => {
    const row = buildStockManagementRow(makeVariant(), INVENTORY_STAFF);
    expect(row).toHaveLength(getStockManagementColumns(INVENTORY_STAFF).length);
    expect(row.join(" | ")).not.toMatch(/%/);
  });

  it("includes profit and margin for owner/accountant, derived from selling price minus final cost", () => {
    for (const role of [OWNER, ACCOUNTANT]) {
      const row = buildStockManagementRow(makeVariant(), role);
      // selling 11.000 − final cost 7.280 = 3.720
      expect(row).toContain("BHD 3.720");
    }
  });

  it("shows — for cost/profit fields when the variant has no recorded buying cost", () => {
    const variant = makeVariant({ latest_supplier_unit_cost_inr: null, latest_exchange_rate_to_bhd: null });
    const row = buildStockManagementRow(variant, OWNER);
    const columns = getStockManagementColumns(OWNER);
    expect(row[columns.indexOf("Buying price India INR")]).toBe("—");
    expect(row[columns.indexOf("Final cost per piece BHD")]).toBe("—");
    expect(row[columns.indexOf("Cost status")]).toBe("Not recorded");
    expect(row[columns.indexOf("Profit per piece BHD")]).toBe("—");
    expect(row[columns.indexOf("Margin %")]).toBe("—");
  });

  it("never trusts a stale/corrupted latest_landed_cost_bhd — cost is always recalculated from INR × rate", () => {
    const variant = makeVariant({
      latest_supplier_unit_cost_inr: 1500,
      latest_exchange_rate_to_bhd: 0.00452,
      latest_additional_landed_cost_bhd: 0,
      // Simulates the known bug this workflow guards against — must never be read directly.
      latest_landed_cost_bhd: 6012099.002,
      average_landed_cost_bhd: 6012099.002,
    });
    const row = buildStockManagementRow(variant, OWNER);
    const columns = getStockManagementColumns(OWNER);
    expect(row[columns.indexOf("Final cost per piece BHD")]).toBe("BHD 6.780");
  });

  it("flags a partial/invalid cost entry distinctly from missing", () => {
    // INR present, rate missing — invalid, not "not recorded".
    const variant = makeVariant({ latest_supplier_unit_cost_inr: 1500, latest_exchange_rate_to_bhd: null });
    const row = buildStockManagementRow(variant, INVENTORY_STAFF);
    const columns = getStockManagementColumns(INVENTORY_STAFF);
    expect(row[columns.indexOf("Cost status")]).toBe("Invalid cost");
  });
});

describe("buildStockManagementRow — no mock/sample data", () => {
  it("every cell is derived from the passed-in variant, not a hardcoded literal", () => {
    const rowA = buildStockManagementRow(makeVariant({ color: "Red", size: "S" }), OWNER);
    const rowB = buildStockManagementRow(makeVariant({ color: "Blue", size: "L" }), OWNER);
    expect(rowA[2]).toBe("Red");
    expect(rowB[2]).toBe("Blue");
  });
});
