/**
 * Structural guard for StickyActionBar — a pure positioning wrapper used on long create/edit
 * forms (New Product, New Sale, Product edit, Order edit, Receive Stock, Correct Quantity) so
 * Cancel/Save/Continue stay reachable without scrolling. Same source-text-guard pattern as
 * breadcrumb.test.ts / back-link.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "sticky-action-bar.tsx"), "utf-8");

describe("StickyActionBar", () => {
  it("is a sticky-positioned bottom bar", () => {
    expect(source).toContain("sticky bottom-0");
  });
  it("accepts children and an optional className to merge with its own", () => {
    expect(source).toContain("children: ReactNode");
    expect(source).toContain("className?: string");
    expect(source).toContain("cn(");
  });
});

describe("StickyActionBar usage — wired into long forms", () => {
  const usages: [string, string][] = [
    [join(__dirname, "..", "products", "product-wizard.tsx"), "New Product wizard"],
    [join(__dirname, "..", "orders", "sale-wizard.tsx"), "New Sale wizard"],
    [join(__dirname, "..", "products", "product-form.tsx"), "Product edit form"],
    [join(__dirname, "..", "orders", "order-edit-form.tsx"), "Order edit form"],
    [join(__dirname, "..", "inventory", "receive-stock-form.tsx"), "Receive Stock form"],
    [join(__dirname, "..", "inventory", "stock-adjustment-form.tsx"), "Correct Quantity form"],
  ];

  for (const [path, label] of usages) {
    it(`${label} uses StickyActionBar for its footer actions`, () => {
      const fileSource = readFileSync(path, "utf-8");
      expect(fileSource).toContain("StickyActionBar");
    });
  }
});
