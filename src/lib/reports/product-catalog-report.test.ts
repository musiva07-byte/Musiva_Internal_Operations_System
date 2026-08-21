/**
 * Tests for the Product Catalog Print/PDF/CSV export column gating (product-catalog-report.ts).
 * This is the single place that decides which columns each role sees for both the print
 * view and the CSV file — see the file's own doc comment for why that matters.
 */
import { describe, it, expect } from "vitest";
import {
  productStockTier,
  productStockStatusLabel,
  getProductCatalogCsvColumns,
  getProductCatalogPrintColumns,
  buildProductCatalogCsvRow,
  buildProductCatalogPrintRow,
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

describe("productStockTier / productStockStatusLabel", () => {
  it("reports out_of_stock / Out of stock when any variant is out", () => {
    expect(productStockTier({ out_of_stock_count: 1, low_stock_count: 0 })).toBe("out_of_stock");
    expect(productStockStatusLabel({ out_of_stock_count: 1, low_stock_count: 0 })).toBe("Out of stock");
  });

  it("reports low_stock / Low stock when none are out but some are low", () => {
    expect(productStockTier({ out_of_stock_count: 0, low_stock_count: 2 })).toBe("low_stock");
    expect(productStockStatusLabel({ out_of_stock_count: 0, low_stock_count: 2 })).toBe("Low stock");
  });

  it("reports in_stock / In stock otherwise", () => {
    expect(productStockTier({ out_of_stock_count: 0, low_stock_count: 0 })).toBe("in_stock");
    expect(productStockStatusLabel({ out_of_stock_count: 0, low_stock_count: 0 })).toBe("In stock");
  });
});

describe("getProductCatalogCsvColumns — cleaned columns + role gating", () => {
  it("gives roles with no cost visibility only the cleaned base columns, led by Image URL", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      expect(getProductCatalogCsvColumns(role)).toEqual([
        "Image URL",
        "Product code / SKU",
        "Product name",
        "Category",
        "Stock status summary",
        "Website status",
        "Selling price BHD",
      ]);
    }
  });

  it("adds buying-cost columns for inventory_staff but not profit columns (canViewBuyingCost, not canViewCostData)", () => {
    const columns = getProductCatalogCsvColumns(INVENTORY_STAFF);
    expect(columns).toContain("Total buying value India INR");
    expect(columns).toContain("Final stock cost Bahrain BHD");
    expect(columns).not.toContain("Estimated gross profit BHD");
    expect(columns).not.toContain("Estimated margin %");
  });

  it("adds both buying-cost and profit columns for accountant, owner, and manager", () => {
    for (const role of [ACCOUNTANT, OWNER, MANAGER]) {
      const columns = getProductCatalogCsvColumns(role);
      expect(columns).toContain("Total buying value India INR");
      expect(columns).toContain("Estimated selling value BHD");
      expect(columns).toContain("Estimated gross profit BHD");
      expect(columns).toContain("Estimated margin %");
    }
  });
});

describe("getProductCatalogPrintColumns — image-first suggested order", () => {
  it("leads with Product image for the print/PDF view", () => {
    expect(getProductCatalogPrintColumns(OWNER)[0].label).toBe("Product image");
  });

  it("matches the suggested column order for a fully-permitted role", () => {
    const labels = getProductCatalogPrintColumns(OWNER).map((c) => c.label);
    expect(labels).toEqual([
      "Product image",
      "Product code / SKU",
      "Product name",
      "Category",
      "Stock status summary",
      "Website status",
      "Selling price BHD",
      "Total buying value India INR",
      "Final stock cost Bahrain BHD",
      "Estimated selling value BHD",
      "Estimated gross profit BHD",
      "Estimated margin %",
    ]);
  });
});

describe("buildProductCatalogCsvRow — base columns (every role)", () => {
  it("includes the required base fields in order, with an Image URL cell first", () => {
    const item = makeItem();
    const row = buildProductCatalogCsvRow(item, SALES_STAFF);
    expect(row).toEqual(["", "MSV-10001", "Satin Dress", "Dresses", "In stock", "Published", "BHD 11.000"]);
  });

  it("uses the product's primary image URL when available", () => {
    const row = buildProductCatalogCsvRow(
      makeItem({ primary_image_url: "https://cdn.example.com/satin-dress.jpg" }),
      SALES_STAFF,
    );
    expect(row[0]).toBe("https://cdn.example.com/satin-dress.jpg");
  });

  it("row length always matches the column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildProductCatalogCsvRow(makeItem(), role);
      expect(row).toHaveLength(getProductCatalogCsvColumns(role).length);
    }
  });

  it("falls back to 'Uncategorized' when there is no category", () => {
    const row = buildProductCatalogCsvRow(makeItem({ category_name: null }), SALES_STAFF);
    expect(row[3]).toBe("Uncategorized");
  });

  it("shows — when there is no selling price yet", () => {
    const row = buildProductCatalogCsvRow(makeItem({ min_selling_price: null }), SALES_STAFF);
    expect(row[row.length - 1]).toBe("—");
  });
});

describe("buildProductCatalogCsvRow — cost/profit permission safety", () => {
  it("never includes buying cost, INR, or profit data for sales_staff / delivery_coordinator", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildProductCatalogCsvRow(makeItem(), role).join(" | ");
      expect(row).not.toMatch(/₹7500|BHD 33\.900|BHD 54\.100/);
    }
  });

  it("includes buying-cost figures for inventory_staff", () => {
    const row = buildProductCatalogCsvRow(makeItem(), INVENTORY_STAFF);
    expect(row.slice(-2)).toEqual(["₹7500.00", "BHD 33.900"]);
  });

  it("does not append profit columns for inventory_staff even though buying cost is shown", () => {
    const row = buildProductCatalogCsvRow(makeItem(), INVENTORY_STAFF);
    expect(row).toHaveLength(getProductCatalogCsvColumns(INVENTORY_STAFF).length);
    expect(row.join(" | ")).not.toMatch(/Margin|Estimated gross profit/i);
  });

  it("includes profit and margin for owner/manager/accountant, computed from selling minus final cost", () => {
    for (const role of [OWNER, MANAGER, ACCOUNTANT]) {
      const row = buildProductCatalogCsvRow(makeItem(), role);
      // selling 88 − final cost 33.9 = 54.1; margin = 54.1 / 88 * 100 = 61.48%
      expect(row).toContain("BHD 54.100");
      expect(row[row.length - 1]).toBe("61.48%");
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
    const row = buildProductCatalogCsvRow(item, OWNER);
    const columns = getProductCatalogCsvColumns(OWNER);
    expect(row[columns.indexOf("Estimated gross profit BHD")]).toBe("—");
    expect(row[columns.indexOf("Estimated margin %")]).toBe("—");
  });
});

describe("buildProductCatalogPrintRow — image cell, badge cell, and row accent", () => {
  it("renders an image cell first, with a null url when there is no primary image", () => {
    const row = buildProductCatalogPrintRow(makeItem(), OWNER);
    expect(row.cells[0]).toEqual({ kind: "image", url: null, alt: "Satin Dress" });
  });

  it("renders the stock status summary as a tier-tagged badge cell", () => {
    const row = buildProductCatalogPrintRow(makeItem({ low_stock_count: 1 }), OWNER);
    expect(row.cells[4]).toEqual({ kind: "badge", label: "Low stock", tier: "low_stock" });
  });

  it("sets the row accentTier to match the stock tier", () => {
    expect(buildProductCatalogPrintRow(makeItem(), OWNER).accentTier).toBe("in_stock");
    expect(buildProductCatalogPrintRow(makeItem({ low_stock_count: 1 }), OWNER).accentTier).toBe("low_stock");
    expect(buildProductCatalogPrintRow(makeItem({ out_of_stock_count: 1 }), OWNER).accentTier).toBe("out_of_stock");
  });

  it("cell count always matches the print column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildProductCatalogPrintRow(makeItem(), role);
      expect(row.cells).toHaveLength(getProductCatalogPrintColumns(role).length);
    }
  });

  it("never leaks cost/profit cells to unauthorized roles", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildProductCatalogPrintRow(makeItem(), role);
      const flat = row.cells
        .map((c) => (typeof c === "object" && c !== null && "kind" in c ? JSON.stringify(c) : String(c ?? "")))
        .join(" | ");
      expect(flat).not.toMatch(/₹7500|BHD 33\.900|BHD 54\.100/);
    }
  });
});

describe("buildProductCatalogCsvRow — no mock/sample data", () => {
  it("every cell is derived from the passed-in item, not a hardcoded literal", () => {
    const itemA = makeItem({ name: "Alpha Kaftan", sku: "ALPHA-1" });
    const itemB = makeItem({ name: "Beta Abaya", sku: "BETA-2" });
    const rowA = buildProductCatalogCsvRow(itemA, OWNER);
    const rowB = buildProductCatalogCsvRow(itemB, OWNER);
    expect(rowA[2]).toBe("Alpha Kaftan");
    expect(rowB[2]).toBe("Beta Abaya");
    expect(rowA[2]).not.toBe(rowB[2]);
  });
});
