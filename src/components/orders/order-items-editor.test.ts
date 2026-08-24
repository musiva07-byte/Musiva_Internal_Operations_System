/**
 * Structural regression guard for OrderItemsEditor — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase). Covers the
 * confirmation popup, success popup, friendly error, and completed-order warning copy
 * required by the Order Edit "change variant/size/color/quantity" workflow.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "order-items-editor.tsx"), "utf-8");

describe("OrderItemsEditor — item actions", () => {
  it("supports change option, add item, and remove item", () => {
    expect(source).toContain("Change option");
    expect(source).toContain("Add item");
    expect(source).toContain("openChangePicker");
    expect(source).toContain("removeItem");
  });

  it("shows a quantity input per item", () => {
    expect(source).toMatch(/type="number"[\s\S]*?onChange=\{\(e\) => updateQuantity/);
  });
});

describe("OrderItemsEditor — confirmation popup (requirement: title, diff, stock impact, totals)", () => {
  it("uses the exact required title", () => {
    expect(source).toContain("Confirm order changes");
  });

  it("shows the order number, customer, and current status", () => {
    expect(source).toContain("order.order_number");
    expect(source).toContain("order.customer.full_name");
    expect(source).toContain("titleize(order.order_status)");
  });

  it("shows old/new for changed, removed, and added items", () => {
    expect(source).toContain("Old:");
    expect(source).toContain("New:");
    expect(source).toContain("diff.changed.map");
    expect(source).toContain("diff.removed.map");
    expect(source).toContain("diff.added.map");
  });

  it("shows a stock impact section with returned/deducted deltas", () => {
    expect(source).toContain("Stock impact");
    expect(source).toMatch(/returned \+\$\{delta\}/);
    expect(source).toMatch(/deducted \$\{delta\}/);
  });

  it("shows totals impact: old total, new total, amount paid, new amount due", () => {
    expect(source).toContain("Old total");
    expect(source).toContain("New total");
    expect(source).toContain("Amount paid");
    expect(source).toContain("New amount due");
  });

  it("shows additional-amount-due or possible-refund/credit depending on direction", () => {
    expect(source).toContain("Additional amount due:");
    expect(source).toContain("Possible refund/credit:");
  });

  it("has Back to edit and Confirm changes actions", () => {
    expect(source).toContain("Back to edit");
    expect(source).toContain("Confirm changes");
  });
});

describe("OrderItemsEditor — success popup (requirement: exact copy + actions)", () => {
  it("uses the exact required success copy", () => {
    expect(source).toContain("Order updated successfully");
    expect(source).toContain("Stock has been adjusted.");
  });

  it("offers View order, Print updated receipt, and Back to orders", () => {
    expect(source).toContain("View order");
    expect(source).toContain("Print updated receipt");
    expect(source).toContain("Back to orders");
  });

  it("prints the receipt (not a stale one) via the live /print/invoice route", () => {
    expect(source).toMatch(/\/print\/invoice\/\$\{order\.id\}/);
  });
});

describe("OrderItemsEditor — friendly error on failure", () => {
  it("uses the exact required friendly error message and logs the real error server-side", () => {
    expect(source).toContain(
      "Could not update order. Please try again or contact the administrator.",
    );
    expect(source).toMatch(/console\.error\(/);
  });
});

describe("OrderItemsEditor — completed order / delivered delivery gating", () => {
  it("shows the exact required warning for a completed order that can still be edited", () => {
    expect(source).toContain("This order is already completed. Editing it will update stock history.");
  });

  it("locks editing entirely when the current role fails the elevated-permission check", () => {
    expect(source).toContain("const locked = requiresElevatedPermission && !canEditElevated;");
    expect(source).toMatch(/Only an owner or manager can change its\s*\n?\s*items\./);
  });
});
