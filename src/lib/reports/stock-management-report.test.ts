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
  buildStockManagementNotes,
  A3_PRINTABLE_WIDTH_PX,
} from "./stock-management-report";
import { summarizeVariantStock, type StockMovementGroup } from "@/lib/utils/stock-history";
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

describe("getStockManagementPrintColumns — 17 columns, image first, compact labels", () => {
  it("has exactly 17 print columns for a fully-authorized role", () => {
    expect(getStockManagementPrintColumns(OWNER)).toHaveLength(17);
  });

  it("leads with a centered Image column for every role", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const [first] = getStockManagementPrintColumns(role);
      expect(first.label).toBe("Image");
      expect(first.fullLabel).toBe("Product image");
      expect(first.align).toBe("center");
    }
  });

  it("keeps every required column (via fullLabel or label), in the required print order with Rate last", () => {
    const fullLabels = getStockManagementPrintColumns(OWNER).map((c) => c.fullLabel ?? c.label);
    expect(fullLabels).toEqual([
      "Product image",
      "Product code / SKU",
      "Product name",
      "Color",
      "Size",
      "Opening stock plus received stock",
      "Net pieces sold",
      "Current stock",
      "Selling price BHD",
      "Buying price India INR",
      "Buy Bahrain per piece BHD",
      "Import cost per piece BHD",
      "Final cost per piece BHD",
      "Total final cost BHD",
      "Profit per piece BHD",
      "Margin %",
      "Exchange rate (1 INR in BHD)",
    ]);
  });

  it("Rate is the final column", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    expect(columns[columns.length - 1].label).toBe("Rate");
  });

  it("prints every CSV column, plus Total Stock and Sold for roles that can read stock history", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      expect(getStockManagementPrintColumns(role)).toHaveLength(getStockManagementCsvColumns(role).length);
    }
    for (const role of [INVENTORY_STAFF, ACCOUNTANT, OWNER]) {
      expect(getStockManagementPrintColumns(role)).toHaveLength(getStockManagementCsvColumns(role).length + 2);
    }
  });

  it("leaves the CSV format unchanged: one Stock status column and no Total Stock or Sold", () => {
    const csv = getStockManagementCsvColumns(OWNER);
    expect(csv).toContain("Stock status");
    expect(csv).not.toContain("Total Stock");
    expect(csv).not.toContain("Sold");
    expect(csv).not.toContain("In Stock");
    expect(buildStockManagementCsvRow(makeVariant(), OWNER)[5]).toBe("5 units — In Stock");
  });

  it("renders the required compact header labels, in the required print order, for a fully-permitted role", () => {
    const labels = getStockManagementPrintColumns(OWNER).map((c) => c.label);
    expect(labels).toEqual([
      "Image",
      "Code / SKU",
      "Product",
      "Color",
      "Size",
      "Total Stock",
      "Sold",
      "In Stock",
      "Sell (BHD)",
      "Buy (INR)",
      "Buy (BHD)",
      "Import (BHD)",
      "Landed (BHD)",
      "Total Cost (BHD)",
      "Profit (BHD)",
      "Margin (%)",
      "Rate",
    ]);
  });

  it("centers the three stock columns", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    for (const label of ["Total Stock", "Sold", "In Stock"]) {
      expect(columns.find((c) => c.label === label)?.align).toBe("center");
    }
  });

  it("lets every text column wrap (never clip or overlap) and keeps every numeric column on one line", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    for (const label of ["Code / SKU", "Product", "Color", "Size"]) {
      expect(columns.find((c) => c.label === label)?.nowrap).toBe(false);
    }

    const currencyLabels = [
      "Sell (BHD)",
      "Buy (INR)",
      "Buy (BHD)",
      "Import (BHD)",
      "Landed (BHD)",
      "Total Cost (BHD)",
      "Profit (BHD)",
      "Margin (%)",
      "Rate",
    ];
    for (const label of currencyLabels) {
      const column = columns.find((c) => c.label === label);
      expect(column?.align).toBe("right");
      expect(column?.nowrap).not.toBe(false);
    }
  });

  // Widths in px on the A3 basis (400mm printable = 1512 CSS px). The "need" figures below are
  // the widest real values measured in Chrome and WebKit at the 14px A3 print font, including
  // cell padding (e.g. "0.003900" = 64px, "MUSTARD YELLOW" = 126px, "FREE SIZE" = 68px).
  // Because the table's type scales with the page (cqi units), a column that fits on the A3
  // basis fits on every paper size.
  const a3Px = (label: string) => {
    const column = getStockManagementPrintColumns(OWNER).find((c) => c.label === label)!;
    return (parseFloat(column.width!) / 100) * A3_PRINTABLE_WIDTH_PX;
  };

  it("A3 basis: the full 17-column set adds up to exactly the 1512px printable width", () => {
    const total = getStockManagementPrintColumns(OWNER).reduce((sum, c) => sum + a3Px(c.label), 0);
    expect(total).toBeCloseTo(A3_PRINTABLE_WIDTH_PX, 0);
  });

  it("gives Color and Size their own separate columns, each wide enough for its longest value", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    const colorIndex = columns.findIndex((c) => c.label === "Color");
    expect(columns[colorIndex + 1].label).toBe("Size");
    expect(a3Px("Color")).toBeGreaterThanOrEqual(126); // "MUSTARD YELLOW"
    expect(a3Px("Size")).toBeGreaterThanOrEqual(68); // "FREE SIZE"
  });

  it("gives Rate enough width for all six decimals of 0.003900, with headroom", () => {
    expect(a3Px("Rate")).toBeGreaterThanOrEqual(64 * 1.15);
  });

  it("sizes every numeric column to at least its widest measured value", () => {
    const needs: Record<string, number> = {
      "Sell (BHD)": 57, // "125.500"
      "Buy (INR)": 72, // "₹125000.00"
      "Buy (BHD)": 49,
      "Import (BHD)": 42,
      "Landed (BHD)": 49,
      "Total Cost (BHD)": 64, // "1140.750"
      "Profit (BHD)": 57,
      "Margin (%)": 66, // "-290.00%"
      Rate: 64, // "0.003900"
    };
    for (const [label, need] of Object.entries(needs)) {
      expect(a3Px(label)).toBeGreaterThanOrEqual(need);
    }
  });

  it("no column clipping: every column fits both its widest value and its widest header word", () => {
    // Header words are measured uppercase at the 12px A3 header font, including padding — the
    // narrow financial columns are bounded by these ("IMPORT", "LANDED", "MARGIN"), not values.
    const headerWord: Record<string, number> = {
      Image: 47,
      "Code / SKU": 40,
      Product: 65,
      Color: 48,
      Size: 33,
      "Total Stock": 46, // "STOCK"
      Sold: 41,
      "In Stock": 46,
      "Sell (BHD)": 43,
      "Buy (INR)": 38,
      "Buy (BHD)": 43,
      "Import (BHD)": 55,
      "Landed (BHD)": 57,
      "Total Cost (BHD)": 44,
      "Profit (BHD)": 50,
      "Margin (%)": 58,
      Rate: 37,
    };
    const value: Record<string, number> = {
      Image: 44, // 38px thumbnail plus cell padding
      "Code / SKU": 81, // "MSV-10001"
      Color: 126, // "MUSTARD YELLOW"
      Size: 68, // "FREE SIZE"
      "Total Stock": 31,
      Sold: 31,
      "In Stock": 31,
    };
    for (const [label, header] of Object.entries(headerWord)) {
      expect(a3Px(label)).toBeGreaterThanOrEqual(Math.max(header, value[label] ?? 0));
    }
  });

  it("Product wraps long names to two lines (the thumbnail row fits them) rather than leaving a wide gap before Color", () => {
    // 465px = the longest test name on one line; 2 lines of the column must hold it.
    expect(a3Px("Product")).toBeLessThan(465);
    expect((a3Px("Product") - 6) * 2).toBeGreaterThan(465);
  });

  it("leaves Color clear headroom so it never crowds Size", () => {
    expect(a3Px("Color")).toBeGreaterThanOrEqual(150);
  });

  it("cuts the Product width that left the gap before Color", () => {
    expect(a3Px("Product")).toBeLessThanOrEqual(270);
  });

  it("gives Product the most space and keeps Image, Code / SKU, Size and the stock columns compact", () => {
    const widths = getStockManagementPrintColumns(OWNER).map((c) => ({ label: c.label, px: a3Px(c.label) }));
    widths.sort((a, b) => a.px - b.px);
    expect(widths[widths.length - 1].label).toBe("Product");
    for (const label of ["Image", "Size", "Total Stock", "Sold", "In Stock"]) {
      expect(a3Px(label)).toBeLessThanOrEqual(90);
    }
    expect(a3Px("Code / SKU")).toBeLessThanOrEqual(100);
  });
});

describe("getStockManagementPrintColumns — page-width-aware widths (Safari printing)", () => {
  // Fixed px/mm widths were the root of the Safari failure: Safari prints on the paper chosen
  // in its dialog, so a table sized for one exact width lost its right-hand columns (Rate).
  it("sizes every column as a percentage of the printable width — never fixed px/mm", () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      for (const column of getStockManagementPrintColumns(role)) {
        expect(column.width).toMatch(/^\d+(\.\d+)?%$/);
      }
    }
  });

  it("the visible columns total 100% of the page width for every role, so nothing overflows", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const total = getStockManagementPrintColumns(role).reduce((sum, c) => sum + parseFloat(c.width!), 0);
      expect(total).toBeCloseTo(100, 1);
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

describe("buildStockManagementPrintRow — image cell, stock number cell, and row accent", () => {
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

  it("renders Stock as a bare, tier-tagged number cell — no unit text, no badge/pill", () => {
    const row = buildStockManagementPrintRow(makeVariant({ stock_quantity: 2 }), OWNER);
    const stockCell = row.cells[7];
    expect(stockCell).toEqual({ kind: "stock-number", quantity: 2, tier: "low_stock" });
  });

  it("stock 0 renders the number 0 tagged out_of_stock (rendered red/bold by ReportTemplate)", () => {
    const row = buildStockManagementPrintRow(makeVariant({ stock_quantity: 0 }), OWNER);
    expect(row.cells[7]).toEqual({ kind: "stock-number", quantity: 0, tier: "out_of_stock" });
  });

  it("stock 1 and 2 render the plain number tagged low_stock (rendered as normal dark text)", () => {
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 1 }), OWNER).cells[7]).toEqual({
      kind: "stock-number",
      quantity: 1,
      tier: "low_stock",
    });
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 2 }), OWNER).cells[7]).toEqual({
      kind: "stock-number",
      quantity: 2,
      tier: "low_stock",
    });
  });

  it("stock 3+ renders the plain number tagged in_stock (rendered green/bold)", () => {
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 3 }), OWNER).cells[7]).toEqual({
      kind: "stock-number",
      quantity: 3,
      tier: "in_stock",
    });
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 42 }), OWNER).cells[7]).toEqual({
      kind: "stock-number",
      quantity: 42,
      tier: "in_stock",
    });
  });

  it('never renders "unit(s)", "Low Stock", or "Out of Stock" text in the Stock cell', () => {
    for (const qty of [0, 1, 2, 3, 10]) {
      const row = buildStockManagementPrintRow(makeVariant({ stock_quantity: qty }), OWNER);
      const cell = row.cells[7];
      const serialized = JSON.stringify(cell);
      expect(serialized).not.toMatch(/unit|Low Stock|Out of Stock|badge/i);
    }
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

  it("pushes cost/profit/rate cells in the required print order, with the bare exchange rate last", () => {
    const row = buildStockManagementPrintRow(makeVariant(), OWNER);
    // Image, Code, Product, Color, Size, Total, Sold, In Stock, Sell = 9 cells, then cost/profit/rate.
    expect(row.cells[8]).toBe("11.000"); // Sell (BHD)
    expect(row.cells.slice(9)).toEqual([
      "₹1500.00", // Buy (INR)
      "6.780", // Buy (BHD)
      "0.500", // Import (BHD)
      "7.280", // Landed (BHD)
      "36.400", // Total Cost (BHD)
      "3.720", // Profit (BHD)
      "33.82%", // Margin (%)
      "0.004520", // Rate — bare number, last
    ]);
  });

  it("Rate regression: an exchange rate of 0.0039 prints as exactly 0.003900 — last cell, all six decimals, never rounded to 0", () => {
    const row = buildStockManagementPrintRow(makeVariant({ latest_exchange_rate_to_bhd: 0.0039 }), OWNER);
    const rate = row.cells[row.cells.length - 1];
    expect(rate).toBe("0.003900");
    expect(rate).not.toBe("0");
    expect(String(rate).split(".")[1]).toHaveLength(6);
  });

  it("Rate keeps every recorded decimal for other realistic rates too", () => {
    for (const [stored, printed] of [
      [0.00452, "0.004520"],
      [0.004567, "0.004567"],
      [0.003, "0.003000"],
    ] as const) {
      const row = buildStockManagementPrintRow(makeVariant({ latest_exchange_rate_to_bhd: stored }), OWNER);
      expect(row.cells[row.cells.length - 1]).toBe(printed);
    }
  });

  it('never repeats a "BHD" prefix in print cells — the column headers already name the currency', () => {
    for (const role of [SALES_STAFF, INVENTORY_STAFF, ACCOUNTANT, OWNER]) {
      const row = buildStockManagementPrintRow(makeVariant(), role);
      for (const cell of row.cells) {
        if (typeof cell === "string") expect(cell).not.toMatch(/BHD/);
      }
    }
  });

  it("matches the spec's worked example exactly (₹1450 + import → landed 7.605, sell 13.000)", () => {
    const row = buildStockManagementPrintRow(
      makeVariant({
        selling_price: 13,
        regular_selling_price_bhd: 13,
        stock_quantity: 1,
        latest_supplier_unit_cost_inr: 1450,
        latest_exchange_rate_to_bhd: 0.0039,
        latest_additional_landed_cost_bhd: 1.95,
      }),
      OWNER,
    );
    expect(row.cells.slice(8)).toEqual([
      "13.000",
      "₹1450.00",
      "5.655",
      "1.950",
      "7.605",
      "7.605",
      "5.395",
      "41.50%",
      "0.003900",
    ]);
  });

  it("keeps a Total Cost of 0.000 for zero stock (existing calculation preserved)", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    const row = buildStockManagementPrintRow(makeVariant({ stock_quantity: 0 }), OWNER);
    expect(row.cells[columns.findIndex((c) => c.label === "Total Cost (BHD)")]).toBe("0.000");
  });

  it('shows "—" in every cost/profit/rate cell when the variant has no recorded buying cost', () => {
    const variant = makeVariant({ latest_supplier_unit_cost_inr: null, latest_exchange_rate_to_bhd: null });
    const row = buildStockManagementPrintRow(variant, OWNER);
    expect(row.cells.slice(9)).toEqual(["—", "—", "—", "—", "—", "—", "—", "—"]);
  });

  it("financial figures are unchanged from the CSV's own numbers — only the print layout/order/format differ", () => {
    const printRow = buildStockManagementPrintRow(makeVariant(), OWNER);
    const csvRow = buildStockManagementCsvRow(makeVariant(), OWNER);
    // CSV (unchanged): ..., Buying INR, Exchange rate (verbose), Buy BHD, Import, Final, Total, Profit, Margin
    expect(csvRow.slice(-8)).toEqual([
      "₹1500.00",
      "1 INR = BHD 0.004520",
      "BHD 6.780",
      "BHD 0.500",
      "BHD 7.280",
      "BHD 36.400",
      "BHD 3.720",
      "33.82%",
    ]);
    // Every CSV figure appears in the print row with the same precision, only without the
    // "BHD " / "1 INR = BHD " labels.
    const printTail = printRow.cells.slice(9);
    for (const csvValue of csvRow.slice(-8)) {
      const bare = String(csvValue).replace("1 INR = BHD ", "").replace("BHD ", "");
      expect(printTail).toContain(bare);
    }
  });

  it("never exposes the Rate column/cell to unauthorized roles", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR]) {
      const columns = getStockManagementPrintColumns(role);
      expect(columns.find((c) => c.label === "Rate")).toBeUndefined();
      const row = buildStockManagementPrintRow(makeVariant(), role);
      expect(row.cells).not.toContain("0.004520");
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

describe("Total Stock, Sold and In Stock in the print report", () => {
  const group = (movement_type: StockMovementGroup["movement_type"], balance_change: number): StockMovementGroup => ({
    variant_id: "variant-1",
    movement_type,
    order_cancelled: false,
    balance_change,
  });
  const brown3xl = makeVariant({ color: "BROWN", size: "3XL", stock_quantity: 3 });
  const summary = summarizeVariantStock("variant-1", 3, [group("opening_stock", 10), group("sale_deduction", -7)]);

  it("prints that exact variant's figures, in Total / Sold / In Stock order", () => {
    const { cells } = buildStockManagementPrintRow(brown3xl, OWNER, summary);
    expect(cells.slice(3, 8)).toEqual([
      "BROWN",
      "3XL",
      "10",
      "7",
      { kind: "stock-number", quantity: 3, tier: "in_stock" },
    ]);
  });

  it("In Stock always comes from the variant's balance, whatever the summary says", () => {
    const { cells } = buildStockManagementPrintRow(brown3xl, OWNER, { ...summary, current_stock_quantity: 99 });
    expect(cells[7]).toMatchObject({ quantity: 3 });
  });

  it("shows zero as 0, but unavailable figures as — and never as 0", () => {
    const zero = summarizeVariantStock("variant-1", 0, []);
    expect(buildStockManagementPrintRow(makeVariant({ stock_quantity: 0 }), OWNER, zero).cells.slice(5, 7)).toEqual(["0", "0"]);
    expect(buildStockManagementPrintRow(makeVariant(), OWNER).cells.slice(5, 7)).toEqual(["—", "—"]);
  });

  it("shows — for both Total Stock and Sold when history is incomplete", () => {
    const incomplete = summarizeVariantStock("variant-1", 5, [group("sale_deduction", -2)]);
    expect(buildStockManagementPrintRow(makeVariant(), OWNER, incomplete).cells.slice(5, 7)).toEqual(["—", "—"]);
  });

  it("changes no financial figure", () => {
    const withSummary = buildStockManagementPrintRow(makeVariant(), OWNER, summary).cells.slice(8);
    const without = buildStockManagementPrintRow(makeVariant(), OWNER).cells.slice(8);
    expect(withSummary).toEqual(without);
    expect(withSummary).toEqual(["11.000", "₹1500.00", "6.780", "0.500", "7.280", "36.400", "3.720", "33.82%", "0.004520"]);
  });

  it("Total Cost still uses the current balance, not Total Stock", () => {
    const columns = getStockManagementPrintColumns(OWNER);
    const { cells } = buildStockManagementPrintRow(makeVariant({ stock_quantity: 5 }), OWNER, summary);
    expect(cells[columns.findIndex((c) => c.label === "Total Cost (BHD)")]).toBe("36.400");
  });

  it("gives sales staff and delivery coordinators In Stock only, with no history or financial cells", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, null]) {
      const labels = getStockManagementPrintColumns(role).map((c) => c.label);
      expect(labels).toEqual(["Image", "Code / SKU", "Product", "Color", "Size", "In Stock", "Sell (BHD)"]);
      expect(buildStockManagementPrintRow(makeVariant(), role, summary).cells).toHaveLength(7);
    }
  });

  it("keeps financial gates per role: accountant gets all 17, inventory staff no profit", () => {
    expect(getStockManagementPrintColumns(ACCOUNTANT)).toHaveLength(17);
    const inventory = getStockManagementPrintColumns(INVENTORY_STAFF).map((c) => c.label);
    expect(inventory).toContain("Total Stock");
    expect(inventory).toContain("Rate");
    expect(inventory).not.toContain("Profit (BHD)");
    expect(inventory).not.toContain("Margin (%)");
  });

  it("every role's cells line up with its columns", () => {
    for (const role of [SALES_STAFF, DELIVERY_COORDINATOR, INVENTORY_STAFF, ACCOUNTANT, OWNER, null]) {
      const row = buildStockManagementPrintRow(makeVariant(), role, summary);
      expect(row.cells).toHaveLength(getStockManagementPrintColumns(role).length);
    }
  });
});

describe("buildStockManagementNotes", () => {
  const history = (overrides: Partial<ReturnType<typeof summarizeVariantStock>>) => ({
    ...summarizeVariantStock("v", 0, []),
    ...overrides,
  });

  it("defines the figures, with nothing else when every row adds up", () => {
    const { notes, warnings } = buildStockManagementNotes(OWNER, [history({})]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("Total Stock = opening stock + received stock");
    expect(warnings).toEqual([]);
  });

  it("reports corrections and unrestored cancellations", () => {
    const { notes } = buildStockManagementNotes(OWNER, [
      history({ corrections_quantity: 2 }),
      history({ corrections_quantity: 1 }),
      history({ cancelled_not_restored_quantity: 1 }),
    ]);
    expect(notes[1]).toContain("2 variants also had quantity corrections (net +3 pieces)");
    expect(notes[2]).toContain("1 variant had cancelled orders with 1 piece not returned to stock");
  });

  it("warns separately about incomplete history and no history", () => {
    const { warnings } = buildStockManagementNotes(OWNER, [
      history({ history_status: "incomplete" }),
      history({ history_status: "incomplete" }),
      history({ history_status: "no_history" }),
    ]);
    expect(warnings[0]).toContain("History incomplete: 2 variants have");
    expect(warnings[1]).toContain("No stock history: 1 variant has");
  });

  it("says so when history failed to load", () => {
    const { notes, warnings } = buildStockManagementNotes(OWNER, null);
    expect(notes).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Stock history could not be loaded");
    expect(warnings[0]).not.toMatch(/get_variant|PGRST|function/i);
  });

  it("prints nothing for roles that don't get the columns", () => {
    expect(buildStockManagementNotes(SALES_STAFF, null)).toEqual({ notes: [], warnings: [] });
  });
});
