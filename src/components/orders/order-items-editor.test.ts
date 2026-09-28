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

  it("shows old→new for changed items, and clear labels for removed/added items", () => {
    expect(source).toContain("Changed item:");
    expect(source).toMatch(/oldLabel\?\.color\} \/ \{oldLabel\?\.size\} → \{newLabel\?\.color\} \/ \{newLabel\?\.size\}/);
    expect(source).toContain("Removed item:");
    expect(source).toContain("Added item:");
    expect(source).toContain("diff.changed.map");
    expect(source).toContain("diff.removed.map");
    expect(source).toContain("diff.added.map");
  });

  it("shows a per-item price impact (old/new line total + difference) for a changed item", () => {
    expect(source).toContain("Old line total:");
    expect(source).toContain("New line total:");
    expect(source).toContain("Difference:");
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

  it("offers View order, Reprint receipt, and Back to orders", () => {
    expect(source).toContain("View order");
    expect(source).toContain("Reprint receipt");
    expect(source).toContain("Back to orders");
  });

  it("offers Reprint package sheet only for delivery orders", () => {
    expect(source).toContain("Reprint package sheet");
    expect(source).toContain('order.fulfilment_method === "delivery"');
    expect(source).toMatch(/\/print\/combined\/\$\{order\.id\}/);
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

  it("requires a note before saving a completed/delivered order edit", () => {
    expect(source).toContain("const noteRequired = requiresElevatedPermission;");
    expect(source).toContain("const noteMissing = noteRequired && !note.trim();");
    expect(source).toContain(
      "Please add a note explaining this change before saving — required when editing a completed or delivered order.",
    );
  });
});

describe("OrderItemsEditor — same-product-first variant picker wiring", () => {
  it("passes mode, currentItem, and sameProductVariants into the picker instead of a bare variant list", () => {
    expect(source).toContain("mode={pickerFor?.mode ?? \"add\"}");
    expect(source).toContain("currentItem={pickerCurrentItem}");
    expect(source).toContain("sameProductVariants={pickerSameProductVariants}");
  });

  it("resolves same-product options from both the page-load fetch and the general browse list", () => {
    expect(source).toContain("function sameProductOptionsFor(productId: string | null)");
    expect(source).toContain("...sameProductVariants, ...variants");
  });
});

describe("OrderItemsEditor — row-level local change preview (no DB write until Review changes)", () => {
  it("shows an inline old→new, stock impact, and price preview the moment a variant is picked", () => {
    expect(source).toMatch(/variantChanged && original/);
    expect(source).toContain("Stock: return");
    expect(source).toContain("deduct");
    expect(source).toContain("Price: {formatBhd(oldLineTotal)} → {formatBhd(newLineTotal)}");
  });
});
