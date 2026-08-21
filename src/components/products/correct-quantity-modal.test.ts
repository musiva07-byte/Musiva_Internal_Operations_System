/**
 * Structural regression guard for CorrectQuantityModal (Edit Product's per-variant "Correct
 * quantity" action) — same source-text-guard pattern as product-cost-dialog.test.ts, since
 * this codebase has no component-rendering harness. adjustStockAction()/adjust_variant_stock's
 * actual movement-creation behavior is tested in inventory-stock-actions.test.ts; this file
 * checks that the modal is wired to it correctly and shows the required copy.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "correct-quantity-modal.tsx"), "utf-8");
/** Source with // comment lines stripped, so checks for actual JSX tags aren't tripped up by
 *  comments that legitimately need to *mention* those tags (e.g. explaining why one is absent). */
const sourceWithoutComments = source
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("CorrectQuantityModal — required content", () => {
  it("uses the exact required title", () => {
    expect(source).toMatch(/<DialogTitle>Correct stock quantity<\/DialogTitle>/);
  });

  it("shows product name, variant color/size, and current stock", () => {
    expect(source).toContain("{productName} — {color} / {size}");
    expect(source).toContain("Current stock");
    expect(source).toMatch(/\{currentStock\} unit/);
  });

  it("has a correct-quantity field, a reason field, and an optional note field", () => {
    expect(source).toContain("Correct quantity");
    expect(source).toContain("Reason");
    expect(source).toContain("Note (optional)");
  });

  it("shows a live +/- adjustment preview", () => {
    expect(source).toContain("Adjustment:");
    expect(source).toMatch(/const delta = newQuantity - currentStock;/);
  });

  it("uses the exact required success message", () => {
    expect(source).toMatch(
      /Stock quantity corrected successfully\. New stock: \{result\.newStock\} unit/,
    );
  });

  it("uses the exact required friendly error message and logs the real error", () => {
    expect(source).toContain("Could not update stock. Please try again or contact the administrator.");
    expect(source).toMatch(/console\.error\(/);
  });

  it("uses the required Save correction button label", () => {
    expect(source).toContain("Save correction");
  });
});

describe("CorrectQuantityModal — never nests a <form> inside Edit Product's own form (regression)", () => {
  // See receive-stock-modal.test.ts for the full explanation — a nested <form> here bubbled
  // its submit event, via React's tree (not the DOM tree, even across the Dialog's portal),
  // up to Edit Product's own onSubmit and opened its price-confirmation popup unintentionally.
  it("never renders a <form> element", () => {
    expect(sourceWithoutComments).not.toMatch(/<form[\s>]/);
  });

  it("submits via a type=\"button\" + onClick, not type=\"submit\"", () => {
    expect(source).toMatch(/type="button"\s*\n?\s*onClick=\{handleSubmit\}/);
    expect(source).not.toContain('type="submit"');
  });
});

describe("CorrectQuantityModal — uses the existing stock movement service, never a direct write", () => {
  it("calls adjustStockAction (adjust_variant_stock RPC), not a raw table update", () => {
    expect(source).toContain("adjustStockAction(");
    expect(source).not.toMatch(/from\("product_variants"\)/);
  });

  it("folds the picked reason into the note via buildCorrectionNote, matching the schema's single note field", () => {
    expect(source).toContain("buildCorrectionNote(reason, note)");
  });

  it("notifies the caller on success so the page can refresh with real data", () => {
    expect(source).toContain("onSuccess()");
  });

  it("blocks submitting a no-op correction (same quantity as current stock)", () => {
    expect(source).toMatch(/newQuantity === currentStock/);
  });
});
