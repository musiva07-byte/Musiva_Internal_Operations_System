/**
 * Structural regression guard for OrderItemVariantPicker — same source-text-guard pattern used
 * across this codebase (no rendering harness). Covers the "Change option" UX rework: the
 * business case is a customer asking to swap size/color on an existing order (e.g. OFF WHITE / L
 * → OFF WHITE / XXL) without staff creating a duplicate order, and staff must be shown the
 * current item, same-product options first, and clear stock-sufficiency status before picking.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "order-item-variant-picker.tsx"), "utf-8");

describe("OrderItemVariantPicker — title and current item context", () => {
  it("uses the required staff-clear title and subtitle for a variant swap", () => {
    expect(source).toContain('mode === "change" ? "Change size / color" : "Add item"');
    expect(source).toContain("Select the correct product option for this order item.");
  });

  it("shows the current item's product, color/size, SKU, quantity, and price at the top", () => {
    expect(source).toContain("Current item");
    expect(source).toContain("currentItem.productName");
    expect(source).toContain("currentItem.color} / {currentItem.size}");
    expect(source).toContain("currentItem.variantSku");
    expect(source).toContain("currentItem.quantity");
    expect(source).toContain("currentItem.unitPrice");
  });
});

describe("OrderItemVariantPicker — same product prioritized over other products", () => {
  it("shows the same product's variants ahead of the general browse list", () => {
    expect(source).toContain("Same product");
    expect(source).toContain("Other products");
    expect(source).toMatch(/sameProductRows\.map\(renderRow\)/);
    expect(source).toMatch(/otherRows\.map\(renderRow\)/);
  });

  it("only shows other products once staff searches, in change mode", () => {
    expect(source).toContain('(v) => !sameProductIds.has(v.id) && (mode === "add" || searching) && matchesSearch(v)');
  });

  it("sorts same-product options by color then size", () => {
    expect(source).toContain("function sortByColorSize(a: OrderableVariantItem, b: OrderableVariantItem)");
    expect(source).toContain("a.color.localeCompare(b.color) || a.size.localeCompare(b.size)");
  });

  it("hides out-of-stock same-product options unless the toggle is on", () => {
    expect(source).toContain("Show out-of-stock options");
    expect(source).toContain("showOutOfStock || v.stock_quantity > 0 || v.id === currentItem?.productVariantId");
  });
});

describe("OrderItemVariantPicker — row status and stock sufficiency", () => {
  it("labels the current variant as Current and disables it", () => {
    expect(source).toContain('return { label: "Current", badgeVariant: "secondary", disabled: true };');
  });

  it("blocks selection and shows a friendly message when stock is insufficient, with no override", () => {
    expect(source).toContain('return { label: "Not enough stock", badgeVariant: "danger", disabled: true };');
    expect(source).not.toMatch(/override/i);
  });

  it("blocks selection entirely for an out-of-stock variant", () => {
    expect(source).toContain('return { label: "Out of stock", badgeVariant: "danger", disabled: true };');
  });

  it("shows available stock and price per row for a selectable variant", () => {
    expect(source).toContain("v.variant_sku");
    expect(source).toContain("formatBhd(activePrice)");
  });
});

describe("OrderItemVariantPicker — no DB write on selection", () => {
  it("only calls onSelect (local state), never a server action, when a row is chosen", () => {
    expect(source).not.toMatch(/updateOrderItemsAction|createSupabaseServerClient|\.rpc\(/);
    expect(source).toContain("onSelect(variant);");
  });
});
