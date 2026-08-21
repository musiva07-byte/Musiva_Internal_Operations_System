/**
 * Structural regression guard for the Stock Management page's row-level "Add stock" action —
 * same source-text-guard pattern as product-cost-dialog.test.ts. Locks in that the row button
 * opens AddStockModal directly (no more redirecting to /admin/inventory/stock-entry and
 * losing the already-selected variant), that it's gated by canAdjustInventory, and that the
 * Receive Stock page/header link is untouched.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Stock Management — row Add stock opens a modal directly on that variant", () => {
  it("no longer links the row action to the stock-entry redirect flow", () => {
    expect(source).not.toContain("/admin/inventory/stock-entry?variantId=");
  });

  it("renders AddStockModal scoped to the row's own variant", () => {
    expect(source).toMatch(/<AddStockModal variant=\{variant\} \/>/);
  });

  it("gates the row action behind canAdjustInventory, not just page access", () => {
    expect(source).toContain("const canAddStock = canAdjustInventory(profile?.role);");
    expect(source).toMatch(/\{canAddStock \? <AddStockModal variant=\{variant\} \/> : null\}/);
  });
});

describe("Stock Management — the general Receive Stock page/link is untouched", () => {
  it("still links to the general Receive Stock page from the page header", () => {
    expect(source).toContain('<Link href="/admin/inventory/stock-entry">');
    expect(source).toContain("Receive stock");
  });
});

describe("Receive Stock page — still exists and is wired to the real stock service", () => {
  const pageSource = readFileSync(join(__dirname, "stock-entry/page.tsx"), "utf-8");
  const formSource = readFileSync(
    join(__dirname, "../../../components/inventory/receive-stock-form.tsx"),
    "utf-8",
  );

  it("the stock-entry page still renders the real receive-stock form with real data", () => {
    expect(pageSource).toContain("ReceiveStockForm");
    expect(pageSource).toContain("listInventoryVariants(");
  });

  it("the receive-stock form still submits through addStockAction (real stock movement service)", () => {
    expect(formSource).toContain("addStockAction(");
    expect(formSource).toContain("export function ReceiveStockForm(");
  });

  it("the receive-stock form still supports searching for any product/variant (the general workflow)", () => {
    expect(formSource).toContain("1. Find product");
    expect(formSource).toContain("2. Select color and size");
  });
});
