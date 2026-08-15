/**
 * Structural regression guard for New Product → Add Image → color images (section 8 of the
 * spec). Same source-text-guard pattern used throughout this project for components with
 * no rendering harness — see product-cost-dialog.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const wizardSource = readFileSync(join(__dirname, "product-wizard.tsx"), "utf-8");

describe("New Product — Add Image step", () => {
  it("keeps the main product image picker", () => {
    expect(wizardSource).toContain("Choose image");
  });

  it("shows an optional color-images section", () => {
    expect(wizardSource).toContain("Color images (optional)");
  });

  it("renders one image control per color entered in Step 2", () => {
    expect(wizardSource).toMatch(/step2\.colors\.map\(\(color\) =>/);
  });

  it("does not force staff to upload every color — the section only appears once a product exists, and each control is independently optional", () => {
    // Gated on createdProductId (i.e. only shown post-creation, alongside the optional main
    // image step) and each ProductImageWidget already supports leaving currentUrl null.
    expect(wizardSource).toMatch(/step2\.colors\.length > 0 && createdProductId &&/);
  });

  it("uses ProductImageWidget (immediate upload) for color images, scoped by color", () => {
    expect(wizardSource).toMatch(/<ProductImageWidget[\s\S]{0,120}color=\{color\}/);
  });

  it("explains the fallback rule to staff in plain language", () => {
    expect(wizardSource).toMatch(/main product image instead/i);
  });
});
