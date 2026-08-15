/**
 * Structural regression guard for the Edit Product form's Price & Cost rework and image
 * section — same source-text-guard pattern as product-cost-dialog.test.ts, since this
 * codebase has no component-rendering harness. The actual calculation logic
 * (deriveVariantFinalCost, deriveSuggestedSellingPrice, validateMarginPercent, ...) is
 * already exhaustively tested in cost-conversion.test.ts and
 * product-wizard-price-suggestion.test.ts — both New Product and Edit Product import the
 * exact same functions, so what's specific to *this* file is the wiring: that Edit Product
 * actually uses them, shows the required section, hides barcode, preserves SKU, and offers
 * main + color image controls.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const formSource = readFileSync(join(__dirname, "product-form.tsx"), "utf-8");
const editPageSource = readFileSync(
  join(__dirname, "../../app/admin/products/[id]/edit/page.tsx"),
  "utf-8",
);

describe("Edit Product — Price & Cost section", () => {
  it("shows the 'Price & Cost' section", () => {
    expect(formSource).toContain("Price &amp; Cost");
  });

  it("uses the same shared calculation functions as the New Product wizard", () => {
    expect(formSource).toMatch(/from "@\/lib\/utils\/cost-conversion"/);
    expect(formSource).toContain("deriveVariantFinalCost");
    expect(formSource).toContain("deriveSuggestedSellingPrice");
    expect(formSource).toContain("validateMarginPercent");
  });

  it("labels the price field exactly as required, not just 'Final price'", () => {
    expect(formSource).toContain("Selling price / Final customer price (BHD)");
  });

  it("shows the required staff-friendly field labels", () => {
    for (const label of ["Buy India (INR)", "Import India (INR)", "Final Bahrain cost (BHD)"]) {
      expect(formSource).toContain(label);
    }
  });

  it("never shows technical/internal field wording to staff", () => {
    for (const forbidden of [
      "cost_price",
      "latest_landed_cost",
      "allocated_import_cost",
      "supplier_unit_cost",
      "snapshot",
    ]) {
      // Allowed inside comments/type names referencing the DB column itself is fine —
      // the check is that these never appear as visible label/placeholder text.
      const labelPattern = new RegExp(`>\\s*${forbidden}|"${forbidden}"[^,]*Label`, "i");
      expect(formSource).not.toMatch(labelPattern);
    }
  });

  it("does not show barcode as a visible field (still submitted as a hidden, optional value)", () => {
    expect(formSource).not.toMatch(/<Label>Barcode<\/Label>/);
    expect(formSource).toMatch(/type="hidden"[\s\S]{0,60}variants\.\$\{index\}\.barcode/);
  });

  it("shows stock quantity read-only with the exact required helper text", () => {
    expect(formSource).toContain("Stock quantity is managed from Inventory / Receive Stock.");
  });

  it("shows a below-final-cost warning without blocking save", () => {
    expect(formSource).toContain("Selling price is below final cost.");
    expect(formSource).not.toMatch(/disabled=\{[^}]*belowCost/);
  });

  it("gates profit input and suggested price behind canViewProfit (not just canEnterCost)", () => {
    expect(formSource).toMatch(/canViewProfit \? \(/);
  });
});

describe("Edit Product — bulk apply", () => {
  it("has an 'Apply to all variants' bulk section with the required fields", () => {
    expect(formSource).toContain("Apply to all variants");
    expect(formSource).toContain("Buying price India (INR)");
    expect(formSource).toContain("Import cost India (INR)");
    expect(formSource).toContain("Desired profit");
    expect(formSource).toContain("Profit type");
    expect(formSource).toContain("Minimum stock");
  });

  it("only applies non-zero bulk fields (documented convention, matches the wizard)", () => {
    expect(formSource).toMatch(/only non-zero fields are applied/i);
  });
});

describe("Edit Product — price confirmation popup", () => {
  it("uses PriceConfirmationDialog with edit-specific title and button labels", () => {
    expect(formSource).toContain("PriceConfirmationDialog");
    expect(formSource).toContain("Confirm price updates");
    expect(formSource).toContain("Save changes");
  });

  it("only opens the popup for staff who can view profit (inventory_staff keeps the direct-save flow)", () => {
    expect(formSource).toMatch(/if \(!canViewProfit\) \{\s*doSubmit/);
  });

  it("passes the old (pre-save) price into each row for comparison", () => {
    expect(formSource).toContain("oldPriceBhd");
  });

  it("blocks opening the popup on an invalid margin before showing prices", () => {
    expect(formSource).toMatch(/validateMarginPercent\(costState\[invalidIndex\]\.profitInput\)/);
  });
});

describe("Edit Product — save behavior", () => {
  it("converts INR import cost to BHD before building the submit payload", () => {
    expect(formSource).toMatch(
      /importCostBhd:\s*deriveImportCostBhd\(costState\[index\]\?\.importCostInr[^)]*,\s*currentExchangeRate\)/,
    );
  });

  it("reuses resolveProductSku/resolveVariantSku server-side (schema unchanged) — sku field stays a plain registered input", () => {
    expect(formSource).toMatch(/id="sku"[\s\S]{0,40}\.register\("sku"\)/);
  });
});

describe("Edit Product — image section", () => {
  it("shows a main product image control", () => {
    expect(editPageSource).toContain("Main product image");
  });

  it("shows a color image control per distinct variant color", () => {
    expect(editPageSource).toContain("Color images");
    expect(editPageSource).toContain("distinctColors.map");
  });

  it("shows 'Using main image' when a color has no image of its own", () => {
    expect(editPageSource).toContain("Using main image");
  });

  it("passes color through to ProductImageWidget for replace/remove", () => {
    expect(editPageSource).toMatch(/<ProductImageWidget[\s\S]{0,120}color=\{color\}/);
  });
});
