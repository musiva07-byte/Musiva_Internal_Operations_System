/**
 * Structural regression guard for ReceiveStockModal (Edit Product's per-variant "Receive
 * stock" action) — same source-text-guard pattern as product-cost-dialog.test.ts, since this
 * codebase has no component-rendering harness. addStockAction()/add_variant_stock's actual
 * movement-creation behavior is tested in inventory-stock-actions.test.ts; this file checks
 * that the modal is wired to it correctly and shows the required copy.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "receive-stock-modal.tsx"), "utf-8");
/** Source with // comment lines stripped, so checks for actual JSX tags aren't tripped up by
 *  comments that legitimately need to *mention* those tags (e.g. explaining why one is absent). */
const sourceWithoutComments = source
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("ReceiveStockModal — required content", () => {
  it("uses the exact required title", () => {
    expect(source).toContain("Receive stock");
    expect(source).toMatch(/<DialogTitle>Receive stock<\/DialogTitle>/);
  });

  it("shows product name, variant color/size, and current stock", () => {
    expect(source).toContain("{productName} — {color} / {size}");
    expect(source).toContain("Current stock");
    expect(source).toMatch(/\{currentStock\} unit/);
  });

  it("has a quantity-to-add field and an optional note field, nothing else required", () => {
    expect(source).toContain("Quantity to add");
    expect(source).toContain("Note (optional)");
  });

  it("shows a live preview of the new stock total", () => {
    expect(source).toMatch(/New stock:/);
    expect(source).toContain("newStockPreview");
    expect(source).toMatch(/const newStockPreview = currentStock \+/);
  });

  it("uses the exact required success message", () => {
    expect(source).toMatch(/Stock received successfully\. New stock: \{result\.newStock\} unit/);
  });

  it("uses the exact required friendly error message and logs the real error", () => {
    expect(source).toContain("Could not update stock. Please try again or contact the administrator.");
    expect(source).toMatch(/console\.error\(/);
  });
});

describe("ReceiveStockModal — never nests a <form> inside Edit Product's own form (regression)", () => {
  // Found in manual testing: this dialog renders inside product-form.tsx's <form>. React
  // bubbles a nested <form>'s submit event up through the *React* component tree (not the
  // DOM tree) even across a Dialog's portal, so a <form onSubmit> here also fired the outer
  // Edit Product form's onSubmit and opened its price-confirmation popup. The fix — a plain
  // onClick button instead of a nested form — matches every other action dialog in this
  // codebase (ProductArchiveDialog, ProductDeleteDialog, ...).
  it("never renders a <form> element", () => {
    expect(sourceWithoutComments).not.toMatch(/<form[\s>]/);
  });

  it("submits via a type=\"button\" + onClick, not type=\"submit\"", () => {
    expect(source).toMatch(/type="button" onClick=\{handleSubmit\}/);
    expect(source).not.toContain('type="submit"');
  });
});

describe("ReceiveStockModal — uses the existing stock movement service, never a direct write", () => {
  it("calls addStockAction (add_variant_stock RPC), not a raw table update", () => {
    expect(source).toContain("addStockAction(");
    expect(source).not.toMatch(/from\("product_variants"\)/);
  });

  it("notifies the caller on success so the page can refresh with real data", () => {
    expect(source).toContain("onSuccess()");
  });
});
