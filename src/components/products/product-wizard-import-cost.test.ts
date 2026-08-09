/**
 * Tests for the Product Add Step 3 import-cost simplification.
 *
 * The wizard is a "use client" component with no rendering-test setup in this project
 * (see other *.test.ts files — UI logic is always extracted into pure, exported helpers
 * instead of testing JSX output). getImportCostDisplayMode is the single rule that drives
 * every collapsed/compact/editor state described in the spec, for both the bulk control
 * and every variant row — so testing it directly covers the actual UI behavior.
 */

import { describe, it, expect } from "vitest";
import {
  deriveVariantConvertedCost,
  deriveVariantFinalCost,
  getImportCostDisplayMode,
} from "./product-wizard";

describe("getImportCostDisplayMode", () => {
  it("is collapsed to 'add' by default — 0 cost, editor closed", () => {
    expect(getImportCostDisplayMode(0, false)).toBe("add");
  });

  it("shows the small '+ Add import cost' state whenever there is no recorded cost and the editor is closed", () => {
    expect(getImportCostDisplayMode(0, false)).toBe("add");
  });

  it("opens the single import-cost field only once the editor is explicitly opened", () => {
    expect(getImportCostDisplayMode(0, true)).toBe("editor");
    expect(getImportCostDisplayMode(0.5, true)).toBe("editor");
  });

  it("shows the compact 'Import cost: BHD X · Edit' state once a value is recorded and the editor is closed", () => {
    expect(getImportCostDisplayMode(0.5, false)).toBe("compact");
  });

  it("never shows the compact state while the value is exactly 0, even if somehow toggled", () => {
    expect(getImportCostDisplayMode(0, false)).not.toBe("compact");
  });
});

describe("import cost defaults and final-cost calculation (unchanged formulas)", () => {
  it("converted buying cost = buying price INR × exchange rate", () => {
    expect(deriveVariantConvertedCost(1500, 0.00452)).toBeCloseTo(6.78, 3);
  });

  it("import cost defaults to 0 and final cost equals converted cost when omitted", () => {
    const converted = deriveVariantConvertedCost(1500, 0.00452);
    const final = deriveVariantFinalCost(1500, 0.00452, 0);
    expect(final).toBe(converted);
  });

  it("final cost = converted cost + import cost once import cost is entered", () => {
    const final = deriveVariantFinalCost(1500, 0.00452, 0.5);
    expect(final).toBeCloseTo(7.28, 3);
  });

  it("final cost stays 0 when there is no valid converted cost yet, regardless of import cost", () => {
    expect(deriveVariantFinalCost(0, 0.00452, 0.5)).toBe(0);
    expect(deriveVariantFinalCost(1500, null, 0.5)).toBe(0);
  });
});
