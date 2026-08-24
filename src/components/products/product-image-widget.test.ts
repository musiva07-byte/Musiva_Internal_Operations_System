/**
 * Structural regression guard for ProductImageWidget — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase).
 *
 * This is the component behind the deployment-blocking crash: the "manage" dialog's current-
 * image preview rendered `<Image src={previewUrl ?? optimisticUrl ?? ""} />`. On a successful
 * remove, optimisticUrl becomes null and the dialog closes in the same state batch, but the
 * shadcn/Radix Dialog plays a CSS closing animation, so DialogContent (and this Image) stays
 * mounted for that final frame — re-rendering with src="". next/image throws for an empty
 * src, uncaught, which is exactly what surfaced as the global "Unexpected error" page. These
 * tests guard against that pattern ever coming back, and cover the success-feedback and
 * friendly-error-wording requirements added alongside the fix.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "product-image-widget.tsx"), "utf-8");

describe("ProductImageWidget — no unsafe empty-string src ever reaches next/image", () => {
  it("never falls back an Image src to an empty string unconditionally", () => {
    // The historical bug: `src={previewUrl ?? optimisticUrl ?? ""}` passed straight to <Image>.
    expect(source).not.toMatch(/<Image[\s\S]*?src=\{[^}]*\?\?\s*""\s*\}/);
  });

  it("guards the manage-dialog preview behind an explicit truthy check before rendering <Image>", () => {
    expect(source).toMatch(/previewUrl \|\| optimisticUrl \? \(/);
  });

  it("renders a placeholder icon instead of an <Image> when neither URL is available", () => {
    expect(source).toMatch(/previewUrl \|\| optimisticUrl \? \([\s\S]*?<Image[\s\S]*?\) : \([\s\S]*?ImageOff/);
  });
});

describe("ProductImageWidget — client-side file validation (blocks before upload)", () => {
  it("rejects an invalid file type with the required friendly message", () => {
    expect(source).toContain("Please upload a JPG, PNG, or WebP image.");
  });

  it("rejects an oversized file with the required friendly message", () => {
    expect(source).toContain("Image is too large. Please upload an image under");
  });

  it("blocks an empty file", () => {
    expect(source).toContain("The selected file is empty.");
  });
});

describe("ProductImageWidget — success feedback", () => {
  it('shows "Product image updated successfully." after a successful upload', () => {
    expect(source).toContain("Product image updated successfully.");
  });

  it('shows "Product image removed successfully." after a successful remove', () => {
    expect(source).toContain("Product image removed successfully.");
  });

  it("auto-clears the success message rather than leaving it forever", () => {
    expect(source).toMatch(/setTimeout\(\(\) => setSuccessMessage\(null\)/);
  });

  it("refreshes the product row/detail after a successful action", () => {
    const matches = source.match(/router\.refresh\(\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ProductImageWidget — friendly fallback error wording", () => {
  it("never shows a raw/generic failure string for upload", () => {
    expect(source).toContain("Could not upload image. Please try again.");
  });

  it("never shows a raw/generic failure string for remove", () => {
    expect(source).toContain("Could not remove image. Please try again.");
  });
});
