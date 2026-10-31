/**
 * Structural regression guard for New Product → Add photos. Same source-text-guard pattern used
 * throughout this project for components with no rendering harness — see
 * product-cost-dialog.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const wizardSource = readFileSync(join(__dirname, "product-wizard.tsx"), "utf-8");

describe("New Product — Add photos step", () => {
  it("uses the same color manager as Edit Product, one card per color from Step 2", () => {
    expect(wizardSource).toContain("<ProductColorImageManager");
    expect(wizardSource).toContain("colors={step2.colors}");
    expect(wizardSource).toContain("productId={createdProductId}");
  });

  it("starts with no photos and needs a saved product to attach them to", () => {
    expect(wizardSource).toContain("images={[]}");
    expect(wizardSource).toMatch(/step === 4 && createdProductId &&[\s\S]{0,600}<ProductColorImageManager/);
  });

  it("no longer has a separate main-image picker", () => {
    expect(wizardSource).not.toContain("Choose image");
    expect(wizardSource).not.toContain("imageFile");
    expect(wizardSource).not.toContain("ProductImageWidget");
  });

  it("lets staff finish without adding any photo", () => {
    expect(wizardSource).toContain("finishProduct");
    expect(wizardSource).not.toMatch(/disabled=\{[^}]*images/);
  });
});
