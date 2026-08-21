/**
 * Structural regression guard for AddStockModal (Stock Management's row-level "Add stock"
 * action) — same source-text-guard pattern as product-cost-dialog.test.ts, since this
 * codebase has no component-rendering harness. addStockAction()/add_variant_stock's actual
 * movement-creation behavior (and the permission check it enforces server-side) is already
 * exhaustively tested in inventory-stock-actions.test.ts; this file checks that the modal is
 * wired to it correctly, shows the required read-only context/copy, and validates input.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "add-stock-modal.tsx"), "utf-8");
const sourceWithoutComments = source
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("AddStockModal — required content", () => {
  it("uses the exact required title", () => {
    expect(source).toMatch(/<DialogTitle>Add stock<\/DialogTitle>/);
  });

  it("is self-contained — includes its own trigger button, opened directly from the row", () => {
    expect(source).toContain("<DialogTrigger asChild>");
    expect(source).toMatch(/<Button size="sm" title="Add stock" type="button" variant="outline">/);
  });

  it("shows product name, product code/SKU, variant color/size, and variant SKU/code", () => {
    expect(source).toContain("{variant.product_name} — {variant.color} / {variant.size}");
    expect(source).toContain("Product code / SKU");
    expect(source).toContain("{variant.product_sku}");
    expect(source).toContain("Variant SKU / code");
    expect(source).toContain("{variant.variant_sku}");
  });

  it("shows current stock and minimum stock as read-only context", () => {
    expect(source).toContain("Current stock");
    expect(source).toMatch(/\{variant\.stock_quantity\} unit/);
    expect(source).toContain("Minimum stock");
    expect(source).toContain("{variant.minimum_stock}");
  });

  it("has a quantity-to-add field and an optional note field, nothing else required", () => {
    expect(source).toContain("Quantity to add");
    expect(source).toContain("Note (optional)");
  });

  it("caps the note at a safe length", () => {
    expect(source).toMatch(/maxLength=\{NOTE_MAX_LENGTH\}/);
    expect(source).toMatch(/NOTE_MAX_LENGTH = 500/);
  });

  it("shows a live preview of the new stock total", () => {
    expect(source).toMatch(/New stock:/);
    expect(source).toMatch(/const newStockPreview = variant\.stock_quantity \+/);
  });

  it("has Cancel and Add stock buttons", () => {
    expect(source).toContain("Cancel");
    expect(source).toMatch(/onClick=\{handleSubmit\}/);
  });

  it("uses the exact required success message", () => {
    expect(source).toMatch(/Stock added successfully\. New stock: \{result\.newStock\} unit/);
  });

  it("uses the exact required friendly error message and logs the real error", () => {
    expect(source).toContain("Could not add stock. Please try again or contact the administrator.");
    expect(source).toMatch(/console\.error\(/);
  });
});

describe("AddStockModal — quantity validation", () => {
  it("rejects a non-integer quantity with a field-level error", () => {
    expect(source).toContain("Quantity must be a whole number.");
    expect(source).toMatch(/!Number\.isInteger\(parsed\)/);
  });

  it("rejects a zero or negative quantity with a field-level error", () => {
    expect(source).toContain("Quantity must be greater than 0.");
  });

  it("keeps the Add stock button disabled until the quantity is valid", () => {
    expect(source).toMatch(/disabled=\{isPending \|\| !isQuantityValid\}/);
  });

  it("shows the field error inline near the quantity input, not just a top-level banner", () => {
    expect(source).toMatch(/\{quantityError \? <p className="text-xs text-destructive">\{quantityError\}<\/p> : null\}/);
  });
});

describe("AddStockModal — never nests a <form> inside an ancestor form (established convention)", () => {
  it("never renders a <form> element", () => {
    expect(sourceWithoutComments).not.toMatch(/<form[\s>]/);
  });

  it("submits via type=\"button\" + onClick, not type=\"submit\"", () => {
    expect(source).not.toContain('type="submit"');
  });
});

describe("AddStockModal — uses the existing stock movement service, never a direct write", () => {
  it("calls addStockAction (add_variant_stock RPC), not a raw table update", () => {
    expect(source).toContain("addStockAction(");
    expect(source).not.toMatch(/from\("product_variants"\)/);
  });

  it("refreshes the page after a successful add instead of leaving stale data on screen", () => {
    expect(source).toContain("router.refresh()");
  });

  it("does not navigate away — no full page reload, matching the 'no page reload unless necessary' requirement", () => {
    expect(source).not.toMatch(/router\.push\(/);
  });
});
