/**
 * Tests for the Product Catalog Print/PDF/CSV export column gating (product-catalog-report.ts).
 * This is the single place that decides which columns each role sees for both the print
 * view and the CSV file — see the file's own doc comment for why that matters.
 */
import { describe, it, expect } from "vitest";
import {
  getProductCatalogColumns,
  buildProductCatalogRow,
  productStockStatusLabel,
} from "./product-catalog-report";
import type { ProductListItem } from "@/types/app";
import type { StaffRole } from "@/types/database";

function makeItem(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: "product-1",
    name: "Satin Dress",
    sku: "MSV-10001",
    category_id: "cat-1",
    collection: null,
    description: null,
    material: null,
    care_instructions: null,
    status: "active",
    slug: "satin-dress",
    website_visible: true,
    online_status: "published",
    website_title: null,
    website_description: null,
    seo_title: null,
    seo_description: null,
    featured: false,
    new_arrival: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    category_name: "Dresses",
    primary_image_url: null,
    variant_count: 2,
    total_stock: 8,
    low_stock_count: 0,
    out_of_stock_count: 0,
    min_selling_price: 11,
    max_selling_price: 13,
    has_active_discount: false,
    variants_quick: [],
    website_ready: true,
    cost_summary: {
      validCostCount: 1,
      missingCostCount: 1,
      totalBuyingValueInr: 7500,
      totalFinalCostBhd: 33.9,
      totalSellingValueBhd: 88,
      variants: [],
    },
    ...overrides,
  } as ProductListItem;
}

const SALES_STAFF: StaffRole = "sales_staff";
const DELIVERY_COORDINATOR: StaffRole = "delivery_coordinator";
const INVENTORY_STAFF: StaffRole = "inventory_staff";
const ACCOUNTANT: StaffRole = "accountant";
const OWNER: StaffRole = "owner";
const MANAGER: StaffRole = "manager";

describe("getProductCatalogColumns — role gating", () => {
  it("gives roles with no cost visibility only the base columns", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      const columns = getProductCatalogColumns(role);
      expect(columns).toEqual([
        "Product name",
        "Product code / SKU",
        "Category",
        "Options count",
        "Total stock",
        "Stock status",
        "Product status",
        "Website status",
        "From price BHD",
      ]);
    }
  });

  it("adds buying-cost columns for inventory_staff but not profit columns (canEnterBuyingCost, not canViewCostData)", () => {
    const columns = getProductCatalogColumns(INVENTORY_STAFF);
    expect(columns).toContain("Cost status");
    expect(columns).toContain("Total buying value India INR");
    expect(columns).not.toContain("Estimated gross profit BHD");
    expect(columns).not.toContain("Estimated margin %");
  });

  it("adds both buying-cost and profit columns for accountant, owner, and manager", () => {
    for (const role of [ACCOUNTANT, OWNER, MANAGER]) {
      const columns = getProductCatalogColumns(role);
      expect(columns).toContain("Cost status");
      expect(columns).toContain("Estimated selling value BHD");
      expect(columns).toContain("Estimated gross profit BHD");
      expect(columns).toContain("Estimated margin %");
    }
  });
});

describe("buildProductCatalogRow — base columns (every role)", () => {
  it("includes the required base fields in order", () => {
    const item = makeItem();
    const row = buildProductCatalogRow(item, SALES_STAFF);
    expect(row).toEqual([
      "Satin Dress",
      "MSV-10001",
      "Dresses",
      2,
      8,
      "In stock",
      "Active",
      "Published",
      "BHD 11.000",
    ]);
  });

  it("row length always matches the column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildProductCatalogRow(makeItem(), role);
      expect(row).toHaveLength(getProductCatalogColumns(role).length);
    }
  });

  it("falls back to 'Uncategorized' when there is no category", () => {
    const row = buildProductCatalogRow(makeItem({ category_name: null }), SALES_STAFF);
    expect(row[2]).toBe("Uncategorized");
  });

  it("shows — when there is no selling price yet", () => {
    const row = buildProductCatalogRow(makeItem({ min_selling_price: null }), SALES_STAFF);
    expect(row[row.length - 1]).toBe("—");
  });
});

describe("productStockStatusLabel", () => {
  it("reports Out of stock when any variant is out", () => {
    expect(productStockStatusLabel({ out_of_stock_count: 1, low_stock_count: 0 })).toBe("Out of stock");
  });

  it("reports Low stock when none are out but some are low", () => {
    expect(productStockStatusLabel({ out_of_stock_count: 0, low_stock_count: 2 })).toBe("Low stock");
  });

  it("reports In stock otherwise", () => {
    expect(productStockStatusLabel({ out_of_stock_count: 0, low_stock_count: 0 })).toBe("In stock");
  });
});

describe("buildProductCatalogRow — cost/profit permission safety", () => {
  it("never includes buying cost, INR, or profit data for sales_staff / delivery_coordinator", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildProductCatalogRow(makeItem(), role).join(" | ");
      expect(row).not.toMatch(/INR|BHD 33\.900|Cost complete|Missing cost/);
    }
  });

  it("includes buying-cost figures for inventory_staff", () => {
    const row = buildProductCatalogRow(makeItem(), INVENTORY_STAFF);
    // Cost status, valid count, missing count, total buying INR, final cost BHD
    expect(row.slice(-5)).toEqual(["Missing cost: 1", 1, 1, "₹7500.00", "BHD 33.900"]);
  });

  it("does not append profit columns for inventory_staff even though buying cost is shown", () => {
    const row = buildProductCatalogRow(makeItem(), INVENTORY_STAFF);
    expect(row).toHaveLength(getProductCatalogColumns(INVENTORY_STAFF).length);
    expect(row.join(" | ")).not.toMatch(/Margin|Estimated gross profit/i);
  });

  it("includes profit and margin for owner/manager/accountant, computed from selling minus final cost", () => {
    for (const role of [OWNER, MANAGER, ACCOUNTANT]) {
      const row = buildProductCatalogRow(makeItem(), role);
      // selling 88 − final cost 33.9 = 54.1
      expect(row).toContain("BHD 54.100");
    }
  });

  it("shows — for profit/margin when no variant has a valid recorded cost", () => {
    const item = makeItem({
      cost_summary: {
        validCostCount: 0,
        missingCostCount: 2,
        totalBuyingValueInr: 0,
        totalFinalCostBhd: 0,
        totalSellingValueBhd: 88,
        variants: [],
      },
    });
    const row = buildProductCatalogRow(item, OWNER);
    const profitIndex = getProductCatalogColumns(OWNER).indexOf("Estimated gross profit BHD");
    const marginIndex = getProductCatalogColumns(OWNER).indexOf("Estimated margin %");
    expect(row[profitIndex]).toBe("—");
    expect(row[marginIndex]).toBe("—");
  });
});

describe("buildProductCatalogRow — no mock/sample data", () => {
  it("every cell is derived from the passed-in item, not a hardcoded literal", () => {
    const itemA = makeItem({ name: "Alpha Kaftan", sku: "ALPHA-1" });
    const itemB = makeItem({ name: "Beta Abaya", sku: "BETA-2" });
    const rowA = buildProductCatalogRow(itemA, OWNER);
    const rowB = buildProductCatalogRow(itemB, OWNER);
    expect(rowA[0]).toBe("Alpha Kaftan");
    expect(rowB[0]).toBe("Beta Abaya");
    expect(rowA[0]).not.toBe(rowB[0]);
  });
});
