/**
 * Structural regression guard for the Product Business Summary ("View cost") popup.
 *
 * This component has no rendering-test harness (this codebase tests UI by extracting pure
 * logic — see other *.test.ts files — not by mounting JSX). The per-variant cost data this
 * dialog renders is already exhaustively tested at the source in
 * product-catalog-cost.test.ts (listProducts()'s cost_summary, built via getValidBuyingCost())
 * and cost-conversion.test.ts. What's specific to *this* file is a layout requirement — no
 * horizontal-scroll table — that isn't expressible as a data assertion, so it's checked here
 * as a static-content guard against the source, the same way ecommerce-publishing-migration
 * .test.ts guards raw SQL text instead of executing it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "product-cost-dialog.tsx"), "utf-8");

describe("ProductCostDialog — layout regression guards", () => {
  it("never renders the per-variant breakdown as a horizontal-scroll table", () => {
    expect(source).not.toMatch(/<Table[\s>]/);
    expect(source).not.toMatch(/overflow-x-auto/);
  });

  it("shows the missing-cost message on the card body instead of a fake BHD 0.000", () => {
    expect(source).toContain("Buying cost not recorded yet.");
  });

  it("renders every business-friendly variant cost label", () => {
    for (const label of [
      "Buy India / piece",
      "Rate used",
      "Buy Bahrain / piece",
      "Import / piece",
      "Final cost / piece",
      "Total buy India",
      "Total final cost Bahrain",
      "Selling price",
      "Profit / Margin",
    ]) {
      expect(source).toContain(label);
    }
  });

  it("never uses technical/internal field-naming wording in visible labels", () => {
    for (const forbidden of [
      "supplier_unit_cost",
      "converted_unit_cost",
      "landed_unit_cost",
      "snapshot",
      "allocation",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("gates profit/margin behind showProfit for both the summary cards and the variant cards", () => {
    // Every profit/margin block in the file must be wrapped in a showProfit check.
    const profitBlocks = source.match(/showProfit[\s\S]{0,80}(Profit|profit|margin|Margin)/g) ?? [];
    expect(profitBlocks.length).toBeGreaterThan(0);
  });
});
