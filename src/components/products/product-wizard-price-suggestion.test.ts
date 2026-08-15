/**
 * Tests for the Product Add Step 3 cost/profit calculator: staff enter buying price and
 * import cost in INR plus a desired profit, and the system suggests a final customer selling
 * price — reviewed (and optionally corrected) in a confirmation popup before the product is
 * created.
 *
 * As with the other product-wizard-*.test.ts files, this component has no rendering-test
 * harness — the calculation logic is extracted into pure, exported functions and tested
 * directly. What can't be expressed as a data assertion (the popup exists and is wired up,
 * the save payload converts INR to BHD, barcode stays null) is checked as a source-text
 * guard, the same pattern product-cost-dialog.test.ts already uses.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveVariantConvertedCost,
  deriveImportCostBhd,
  deriveVariantFinalCost,
  validateMarginPercent,
  deriveSuggestedSellingPrice,
  calcEstimatedProfit,
  calcEstimatedMargin,
} from "@/lib/utils/cost-conversion";

const wizardSource = readFileSync(join(__dirname, "product-wizard.tsx"), "utf-8");
const popupSource = readFileSync(join(__dirname, "price-confirmation-dialog.tsx"), "utf-8");

// ── import cost: INR in, BHD out ─────────────────────────────────────────────

describe("deriveImportCostBhd", () => {
  it("converts import cost from INR to BHD using the same rule as buying price", () => {
    expect(deriveImportCostBhd(200, 0.00452)).toBeCloseTo(0.904, 3);
  });

  it("is 0 when import cost is 0", () => {
    expect(deriveImportCostBhd(0, 0.00452)).toBe(0);
  });

  it("is 0 without a valid exchange rate", () => {
    expect(deriveImportCostBhd(200, null)).toBe(0);
    expect(deriveImportCostBhd(200, 0)).toBe(0);
  });
});

// ── final cost = buying INR converted + import INR converted ────────────────

describe("deriveVariantFinalCost (buying + import, both entered in INR)", () => {
  it("final cost = converted buying cost when import cost is 0", () => {
    const converted = deriveVariantConvertedCost(1500, 0.00452);
    expect(deriveVariantFinalCost(1500, 0.00452, 0)).toBe(converted);
  });

  it("final cost = converted buying cost + converted import cost", () => {
    // buying: 1500 × 0.00452 = 6.78, import: 200 × 0.00452 = 0.904 → 7.684
    expect(deriveVariantFinalCost(1500, 0.00452, 200)).toBeCloseTo(7.684, 3);
  });

  it("matches the spec example: 05T, buying 1500 INR, import 200 INR", () => {
    const finalCost = deriveVariantFinalCost(1500, 0.00452, 200);
    expect(finalCost).toBeGreaterThan(deriveVariantConvertedCost(1500, 0.00452));
  });

  it("stays 0 without a valid converted buying cost, regardless of import cost", () => {
    expect(deriveVariantFinalCost(0, 0.00452, 200)).toBe(0);
    expect(deriveVariantFinalCost(1500, null, 200)).toBe(0);
  });
});

// ── margin validation ─────────────────────────────────────────────────────────

describe("validateMarginPercent", () => {
  it("rejects a negative margin", () => {
    expect(validateMarginPercent(-5)).toMatch(/cannot be negative/i);
  });

  it("rejects a margin of exactly 100", () => {
    expect(validateMarginPercent(100)).toMatch(/less than 100/i);
  });

  it("rejects a margin greater than 100", () => {
    expect(validateMarginPercent(150)).toMatch(/less than 100/i);
  });

  it("accepts 0", () => {
    expect(validateMarginPercent(0)).toBeNull();
  });

  it("accepts a normal margin like 30%", () => {
    expect(validateMarginPercent(30)).toBeNull();
  });

  it("accepts just under 100", () => {
    expect(validateMarginPercent(99.9)).toBeNull();
  });
});

// ── suggested selling price ───────────────────────────────────────────────────

describe("deriveSuggestedSellingPrice — profit amount", () => {
  it("suggested price = final cost + desired profit amount", () => {
    // final cost 7.684, profit 2.316 → 10.000
    expect(deriveSuggestedSellingPrice(7.684, "amount", 2.316)).toBeCloseTo(10.0, 3);
  });

  it("suggested price = final cost when desired profit is 0", () => {
    expect(deriveSuggestedSellingPrice(6.78, "amount", 0)).toBe(6.78);
  });

  it("treats a negative profit input as 0 rather than reducing the price below cost", () => {
    expect(deriveSuggestedSellingPrice(6.78, "amount", -5)).toBe(6.78);
  });

  it("is 0 when there is no valid final cost yet", () => {
    expect(deriveSuggestedSellingPrice(0, "amount", 5)).toBe(0);
  });
});

describe("deriveSuggestedSellingPrice — margin percentage", () => {
  it("suggested price = final cost / (1 - margin / 100)", () => {
    // final cost 6.78, margin 32.2% → 6.78 / 0.678 ≈ 10.000
    expect(deriveSuggestedSellingPrice(6.78, "margin", 32.2)).toBeCloseTo(10.0, 1);
  });

  it("suggested price equals final cost at 0% margin", () => {
    expect(deriveSuggestedSellingPrice(6.78, "margin", 0)).toBe(6.78);
  });

  it("returns 0 for an invalid margin (>= 100) rather than an infinite/negative price", () => {
    expect(deriveSuggestedSellingPrice(6.78, "margin", 100)).toBe(0);
    expect(deriveSuggestedSellingPrice(6.78, "margin", 150)).toBe(0);
  });

  it("returns 0 for a negative margin", () => {
    expect(deriveSuggestedSellingPrice(6.78, "margin", -10)).toBe(0);
  });

  it("is 0 when there is no valid final cost yet", () => {
    expect(deriveSuggestedSellingPrice(0, "margin", 30)).toBe(0);
  });
});

// ── profit/margin display (reusing the existing, already-tested helpers) ────

describe("profit/margin display formulas", () => {
  it("profit = selling price - final cost", () => {
    expect(calcEstimatedProfit(10, 6.78)).toBeCloseTo(3.22, 3);
  });

  it("margin = profit / selling price × 100", () => {
    expect(calcEstimatedMargin(10, 6.78)).toBeCloseTo(32.2, 1);
  });

  it("margin is null (never divides by zero) when selling price is 0", () => {
    expect(calcEstimatedMargin(0, 6.78)).toBeNull();
  });
});

// ── UI wiring: confirmation popup ─────────────────────────────────────────────

describe("Step 3 — confirmation popup wiring", () => {
  it("only opens the popup for staff who can view profit/margin", () => {
    expect(wizardSource).toMatch(/canViewProfit\s*&&[\s\S]{0,40}<PriceConfirmationDialog/);
  });

  it("staff without profit visibility keep the direct-create flow (no popup gate)", () => {
    expect(wizardSource).toMatch(/if\s*\(!canViewProfit\)\s*\{\s*handleSubmit\(\);/);
  });

  it("blocks opening the popup on an invalid margin before showing prices", () => {
    expect(wizardSource).toMatch(/validateMarginPercent\(invalid\.profitInput\)/);
  });
});

describe("Price confirmation popup — content and behavior", () => {
  it("has the exact title required by the spec", () => {
    expect(popupSource).toContain("Confirm product prices");
  });

  it("has both required buttons", () => {
    expect(popupSource).toContain("Back to edit");
    expect(popupSource).toMatch(/Create product/);
  });

  it("shows every required column", () => {
    for (const label of [
      "Buying India",
      "Import India",
      "Total India cost",
      "Final cost Bahrain",
      "Selling price / Final customer price (BHD)",
      "Suggested:",
      "Profit:",
    ]) {
      expect(popupSource).toContain(label);
    }
  });

  it("the final customer price is an editable input, not read-only text", () => {
    expect(popupSource).toMatch(/<Input[\s\S]{0,300}setPrices/);
  });

  it("editing the price recalculates profit/margin from the same edited value (no stale state)", () => {
    expect(popupSource).toMatch(/calcEstimatedProfit\(price, row\.finalCostBhd\)/);
    expect(popupSource).toMatch(/calcEstimatedMargin\(price, row\.finalCostBhd\)/);
  });

  it("shows the exact required warning when price is below final cost, without blocking", () => {
    expect(popupSource).toContain("Selling price is below final cost.");
    expect(popupSource).not.toMatch(/disabled=\{.*belowCost/);
  });
});

// ── Save behavior ──────────────────────────────────────────────────────────────

describe("Step 3 — save behavior", () => {
  it("converts INR import cost to BHD before sending it to the server", () => {
    expect(wizardSource).toMatch(
      /importCostBhd:\s*deriveImportCostBhd\(v\.importCostInr,\s*effectiveExchangeRate\)/,
    );
  });

  it("never sends a raw INR import-cost field to the product schema (only the converted BHD one)", () => {
    // The variants payload should reference importCostBhd (the schema field), not importCostInr.
    const variantsBlockMatch = wizardSource.match(
      /variants:\s*variantsToSubmit\.map\(\(v\) => \(\{[\s\S]*?\}\)\),/,
    );
    expect(variantsBlockMatch).not.toBeNull();
    expect(variantsBlockMatch![0]).not.toMatch(/importCostInr:/);
  });

  it("barcode is always sent as null (never an empty string)", () => {
    expect(wizardSource).toMatch(/barcode:\s*null,/);
  });

  it("submits with an explicit variant list so the popup's edited prices are used, not stale state", () => {
    expect(wizardSource).toMatch(/function handleSubmit\(variantsOverride\?:\s*WizardVariant\[\]\)/);
    expect(wizardSource).toMatch(/handleSubmit\(finalVariants\)/);
  });
});
