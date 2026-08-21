/**
 * Tests for the Stock Management Print/PDF/CSV export column gating
 * (stock-management-report.ts). getValidBuyingCost() stays the one calculation authority —
 * these tests also guard against a stale/corrupted latest_landed_cost_bhd ever leaking into
 * the export, the same rule cost-conversion.test.ts enforces for the UI.
 */
import { describe, it, expect } from "vitest";
import {
  stockTierForQuantity,
  stockStatusLabel,
  getStockManagementCsvColumns,
  getStockManagementPrintColumns,
  buildStockManagementCsvRow,
  buildStockManagementPrintRow,
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

describe("stockTierForQuantity — fixed numeric thresholds", () => {
  it("maps 3+ to in_stock", () => {
    expect(stockTierForQuantity(3)).toBe("in_stock");
    expect(stockTierForQuantity(5)).toBe("in_stock");
  });

  it("maps 1-2 to low_stock", () => {
    expect(stockTierForQuantity(1)).toBe("low_stock");
    expect(stockTierForQuantity(2)).toBe("low_stock");
  });

  it("maps 0 to out_of_stock", () => {
    expect(stockTierForQuantity(0)).toBe("out_of_stock");
  });

  it("maps negative quantities to invalid", () => {
    expect(stockTierForQuantity(-1)).toBe("invalid");
  });
});

describe("stockStatusLabel — exact required wording", () => {
  it('renders "3 units — In Stock" at the in-stock boundary', () => {
    expect(stockStatusLabel(3)).toBe("3 units — In Stock");
  });

  it('renders "2 units — Low Stock" for low stock', () => {
    expect(stockStatusLabel(2)).toBe("2 units — Low Stock");
  });

  it('renders "0 units — Out of Stock" for out of stock', () => {
    expect(stockStatusLabel(0)).toBe("0 units — Out of Stock");
  });

  it('renders "Invalid stock" for a negative quantity', () => {
    expect(stockStatusLabel(-1)).toBe("Invalid stock");
  });

  it("uses singular unit wording for exactly 1", () => {
    expect(stockStatusLabel(1)).toBe("1 unit — Low Stock");
  });
});

describe("getStockManagementCsvColumns — removed columns + role gating", () => {
  it("never includes the removed technical columns for any role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const columns = getStockManagementCsvColumns(role);
      expect(columns).not.toContain("Variant code");
      expect(columns).not.toContain("Available stock");
      expect(columns).not.toContain("Minimum stock");
      expect(columns).not.toContain("Cost status");
    }
  });

  it("gives roles with no cost visibility only the base columns, led by Image URL", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      expect(getStockManagementCsvColumns(role)).toEqual([
        "Image URL",
        "Product code / SKU",
        "Product name",
        "Color",
        "Size",
        "Stock status",
        "Selling price BHD",
      ]);
    }
  });

  it("adds buying-cost columns (INR, exchange rate, final cost) for canViewBuyingCost roles", () => {
    for (const role of [INVENTORY_STAFF, ACCOUNTANT, OWNER]) {
      const columns = getStockManagementCsvColumns(role);
      expect(columns).toContain("Buying price India INR");
      expect(columns).toContain("Exchange rate");
      expect(columns).toContain("Final cost per piece BHD");
      expect(columns).toContain("Total final cost BHD");
    }
  });

  it("only adds profit/margin columns for canViewCostData roles, not inventory_staff", () => {
    expect(getStockManagementCsvColumns(INVENTORY_STAFF)).not.toContain("Profit per piece BHD");
    expect(getStockManagementCsvColumns(INVENTORY_STAFF)).not.toContain("Margin %");
    for (const role of [ACCOUNTANT, OWNER]) {
      expect(getStockManagementCsvColumns(role)).toContain("Profit per piece BHD");
      expect(getStockManagementCsvColumns(role)).toContain("Margin %");
    }
  });
});

describe("getStockManagementPrintColumns — image-first, all 15 columns kept, compact labels", () => {
  it("leads with an Image column whose full label is Product image", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    expect(columns[0].label).toBe("Image");
    expect(columns[0].fullLabel).toBe("Product image");
  });

  it("keeps every required column (via fullLabel or label) in the required order — none removed", () => {
    const fullLabels = getStockManagementPrintColumns(OWNER).map((c) => c.fullLabel ?? c.label);
    expect(fullLabels).toEqual([
      "Product image",
      "Product code / SKU",
      "Product name",
      "Color",
      "Size",
      "Stock status",
      "Selling price BHD",
      "Buying price India INR",
      "Exchange rate",
      "Buy Bahrain per piece BHD",
      "Import cost per piece BHD",
      "Final cost per piece BHD",
      "Total final cost BHD",
      "Profit per piece BHD",
      "Margin %",
    ]);
  });

  it("has the same column count as the CSV export for every role — nothing dropped from print only", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      expect(getStockManagementPrintColumns(role)).toHaveLength(getStockManagementCsvColumns(role).length);
    }
  });

  it("renders the required compact header labels for a fully-permitted role", () => {
    const labels = getStockManagementPrintColumns(OWNER).map((c) => c.label);
    expect(labels).toEqual([
      "Image",
      "Code / SKU",
      "Product",
      "Color",
      "Size",
      "Stock",
      "Sell",
      "Buy INR",
      "Rate",
      "Buy BHD",
      "Import BHD",
      "Final BHD",
      "Total Cost",
      "Profit",
      "Margin",
    ]);
  });

  it("marks every currency/numeric column right-aligned and nowrap, except the wrapping product name", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    const productColumn = columns.find((c) => c.fullLabel === "Product name");
    expect(productColumn?.nowrap).toBe(false);

    const currencyLabels = [
      "Sell",
      "Buy INR",
      "Rate",
      "Buy BHD",
      "Import BHD",
      "Final BHD",
      "Total Cost",
      "Profit",
      "Margin",
    ];
    for (const label of currencyLabels) {
      const column = columns.find((c) => c.label === label);
      expect(column?.align).toBe("right");
      expect(column?.nowrap).not.toBe(false);
    }
  });

  it("gives every column a fixed width so the wide table lays out predictably", () => {
    for (const column of getStockManagementPrintColumns(OWNER)) {
      expect(column.width).toMatch(/^\d+px$/);
    }
  });
});

describe("buildStockManagementCsvRow — base columns (every role)", () => {
  it("includes the required base fields in order, with an Image URL cell first", () => {
    const row = buildStockManagementCsvRow(makeVariant(), SALES_STAFF);
    expect(row).toEqual([
      "",
      "MSV-10001",
      "Satin Dress",
      "Black",
      "M",
      "5 units — In Stock",
      "BHD 11.000",
    ]);
  });

  it("uses the variant's primary image URL when available", () => {
    const row = buildStockManagementCsvRow(
      makeVariant({ primary_image_url: "https://cdn.example.com/black-satin.jpg" }),
      SALES_STAFF,
    );
    expect(row[0]).toBe("https://cdn.example.com/black-satin.jpg");
  });

  it("row length always matches the column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildStockManagementCsvRow(makeVariant(), role);
      expect(row).toHaveLength(getStockManagementCsvColumns(role).length);
    }
  });
});

describe("buildStockManagementCsvRow — cost/profit permission safety", () => {
  it("never includes buying INR, exchange rate, or cost figures for unauthorized roles", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildStockManagementCsvRow(makeVariant(), role).join(" | ");
      expect(row).not.toMatch(/₹1500|0\.004520|BHD 6\.780|BHD 7\.280/);
    }
  });

  it("includes correctly derived buying cost figures for inventory_staff", () => {
    const row = buildStockManagementCsvRow(makeVariant(), INVENTORY_STAFF);
    // buying 1500 INR × 0.00452 = 6.780, + import 0.5 = final 7.280; total = 7.280 × 5 = 36.400
    expect(row.slice(-6)).toEqual([
      "₹1500.00",
      "1 INR = BHD 0.004520",
      "BHD 6.780",
      "BHD 0.500",
      "BHD 7.280",
      "BHD 36.400",
    ]);
  });

  it("does not append profit/margin for inventory_staff even though cost is shown", () => {
    const row = buildStockManagementCsvRow(makeVariant(), INVENTORY_STAFF);
    expect(row).toHaveLength(getStockManagementCsvColumns(INVENTORY_STAFF).length);
    expect(row.join(" | ")).not.toMatch(/%/);
  });

  it("includes profit and margin for owner/accountant, derived from selling price minus final cost", () => {
    for (const role of [OWNER, ACCOUNTANT]) {
      const row = buildStockManagementCsvRow(makeVariant(), role);
      // selling 11.000 − final cost 7.280 = 3.720
      expect(row).toContain("BHD 3.720");
      expect(row[row.length - 1]).toBe("33.82%");
    }
  });

  it("shows — for cost/profit fields when the variant has no recorded buying cost", () => {
    const variant = makeVariant({ latest_supplier_unit_cost_inr: null, latest_exchange_rate_to_bhd: null });
    const row = buildStockManagementCsvRow(variant, OWNER);
    const columns = getStockManagementCsvColumns(OWNER);
    expect(row[columns.indexOf("Buying price India INR")]).toBe("—");
    expect(row[columns.indexOf("Final cost per piece BHD")]).toBe("—");
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
    const row = buildStockManagementCsvRow(variant, OWNER);
    const columns = getStockManagementCsvColumns(OWNER);
    expect(row[columns.indexOf("Final cost per piece BHD")]).toBe("BHD 6.780");
  });
});

describe("buildStockManagementPrintRow — image cell, badge cell, and row accent", () => {
  it("renders an image cell first, falling back to a null-url placeholder when there is no image", () => {
    const row = buildStockManagementPrintRow(makeVariant(), OWNER);
    expect(row.cells[0]).toEqual({ kind: "image", url: null, alt: "Satin Dress — Black" });
  });

  it("uses the variant's primary image URL when available", () => {
    const row = buildStockManagementPrintRow(
      makeVariant({ primary_image_url: "https://cdn.example.com/black-satin.jpg" }),
      OWNER,
    );
    expect(row.cells[0]).toEqual({
      kind: "image",
      url: "https://cdn.example.com/black-satin.jpg",
      alt: "Satin Dress — Black",
    });
  });

  it("renders the combined Stock Status as a tier-tagged badge cell", () => {
    const row = buildStockManagementPrintRow(makeVariant({ stock_quantity: 2 }), OWNER);
    const badgeCell = row.cells[5];
    expect(badgeCell).toEqual({ kind: "badge", label: "2 units — Low Stock", tier: "low_stock" });
  });

  it("sets the row accentTier to match the stock tier for the highlight border", () => {
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 5 }), OWNER).accentTier).toBe("in_stock");
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 2 }), OWNER).accentTier).toBe("low_stock");
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 0 }), OWNER).accentTier).toBe("out_of_stock");
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: -3 }), OWNER).accentTier).toBe("invalid");
  });

  it("cell count always matches the print column count for that role", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildStockManagementPrintRow(makeVariant(), role);
      expect(row.cells).toHaveLength(getStockManagementPrintColumns(role).length);
    }
  });

  it("never leaks cost/profit cells to unauthorized roles", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const row = buildStockManagementPrintRow(makeVariant(), role);
      const flat = row.cells
        .map((c) => (typeof c === "object" && c !== null && "kind" in c ? JSON.stringify(c) : String(c ?? "")))
        .join(" | ");
      expect(flat).not.toMatch(/₹1500|0\.004520|BHD 6\.780|BHD 7\.280/);
    }
  });
});

describe("buildStockManagementCsvRow / buildStockManagementPrintRow — no mock/sample data", () => {
  it("every cell is derived from the passed-in variant, not a hardcoded literal", () => {
    const rowA = buildStockManagementCsvRow(makeVariant({ color: "Red", size: "S" }), OWNER);
    const rowB = buildStockManagementCsvRow(makeVariant({ color: "Blue", size: "L" }), OWNER);
    expect(rowA[3]).toBe("Red");
    expect(rowB[3]).toBe("Blue");
  });
});
