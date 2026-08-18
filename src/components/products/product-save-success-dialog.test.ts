/**
 * Structural regression guard for ProductSaveSuccessDialog — same source-text-guard pattern
 * as product-cost-dialog.test.ts (no rendering harness in this codebase). Locks in the exact
 * required copy and actions for the Create/Edit Product success feedback.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "product-save-success-dialog.tsx"), "utf-8");

describe("ProductSaveSuccessDialog — required copy", () => {
  it("shows the exact required edit-success message", () => {
    expect(source).toContain("Product updated successfully");
  });

  it("shows the exact required create-success message", () => {
    expect(source).toContain("Product created successfully");
  });

  it("shows the product name", () => {
    expect(source).toContain("info.productName");
  });

  it("shows variant count and starting stock details", () => {
    expect(source).toContain("info.variantCount");
    expect(source).toContain("info.newVariantCount");
    expect(source).toContain("info.startingStock");
  });

  it("shows website status", () => {
    expect(source).toContain("info.onlineStatus");
  });

  it("only mentions buying cost when cost actually changed", () => {
    expect(source).toMatch(/info\.costChanged \? \(/);
  });
});

describe("ProductSaveSuccessDialog — actions", () => {
  it("offers View product and Back to catalog for both create and edit", () => {
    expect(source).toContain("View product");
    expect(source).toContain("Back to catalog");
    expect(source).toContain("onViewProduct");
    expect(source).toContain("onBackToCatalog");
  });

  it("offers Continue editing only in edit mode", () => {
    expect(source).toMatch(/isEditing \? \(\s*<Button[^>]*onClick=\{onContinueEditing\}/);
    expect(source).toContain("Continue editing");
  });
});
