/**
 * Structural regression guard for the Product Images section. Same source-text-guard pattern used
 * throughout this project for components with no rendering harness — see
 * product-cost-dialog.test.ts. Card contents are tested in lib/utils/product-image.test.ts and
 * row changes in lib/services/product-image.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "product-color-image-manager.tsx"), "utf-8");

describe("ProductColorImageManager — layout", () => {
  it("is a compact 4:5 grid of up to 4 per row on desktop, 3 on tablet, 2 on mobile", () => {
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("sm:grid-cols-3");
    expect(source).toContain("lg:grid-cols-4");
    expect(source).toContain("aspect-[4/5]");
  });

  it("offers the requested controls on each card", () => {
    for (const label of ["Add photo", "Photo not added", "Cover photo", "Set as cover", "Change photo", "Remove photo"]) {
      expect(source).toContain(label);
    }
  });

  it("hides every edit control from a user who can't manage products", () => {
    expect(source).toContain("canEdit && card.image");
    expect(source).toMatch(/\) : canEdit \? \(/);
  });
});

describe("ProductColorImageManager — never crashes on a bad image", () => {
  it("guards the URL before it reaches next/image, and handles a load failure", () => {
    expect(source).toContain("!isUsableImageUrl(url) || failedUrl === url");
    expect(source).toContain("onError={() => setFailedUrl(url)}");
  });

  it("never falls back to an empty string src", () => {
    expect(source).not.toMatch(/src=\{[^}]*\?\?\s*""\s*\}/);
  });

  it("awaits the structured action result instead of letting a failure escape the transition", () => {
    expect(source).toContain("if (!result.ok)");
    expect(source).not.toContain("throw ");
  });
});

describe("ProductColorImageManager — upload flow", () => {
  it("previews first and saves only on confirm", () => {
    expect(source).toContain("URL.createObjectURL(file)");
    expect(source).toContain("disabled={!selectedFile || isPending}");
  });

  it("validates type and size in the browser, with a loading indicator", () => {
    expect(source).toContain("ACCEPT_MIME.includes(file.type)");
    expect(source).toContain("file.size > MAX_BYTES");
    expect(source).toContain("animate-spin");
  });

  it("keeps the dialog and chosen file on failure, so staff can retry", () => {
    expect(source).toMatch(/if \(!result\.ok\) \{\s*setDialogError\(result\.error \?\? UPLOAD_ERROR\);\s*return;\s*\}\s*closeDialogs\(\);/);
  });

  it("releases the preview's object URL", () => {
    expect(source).toContain("URL.revokeObjectURL(previewUrl)");
  });
});

describe("ProductColorImageManager — messages", () => {
  it("uses the color name in success messages", () => {
    expect(source).toContain('`${photoName(card)} photo ${card.image ? "updated" : "uploaded"} successfully.`');
    expect(source).toContain("`${photoName(card)} photo removed successfully.`");
    expect(source).toContain('"Cover photo changed successfully."');
  });

  it("uses the friendly failure wording", () => {
    expect(source).toContain('"Could not upload this photo. Please try again."');
  });
});

describe("ProductColorImageManager — image edits can't reach price or stock", () => {
  it("calls only the three image actions", () => {
    const imports = source.match(/from "@\/app\/[^"]+"/g);
    expect(imports).toEqual(['from "@/app/admin/products/image-actions"']);
    expect(source).not.toMatch(/selling_?price|stock_?quantity|updateProduct/i);
  });
});
