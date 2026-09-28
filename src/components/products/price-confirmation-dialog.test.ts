/**
 * Structural regression guard for PriceConfirmationDialog's review-popup content — same
 * source-text-guard pattern as product-cost-dialog.test.ts (no rendering harness in this
 * codebase). The underlying cost math is already exhaustively tested in cost-conversion.test.ts
 * and product-wizard-price-suggestion.test.ts; what's specific to this file is that the
 * review popup actually surfaces the product name, a website-status change summary, and a
 * per-row changed/new indicator, per the Review & Save spec.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "price-confirmation-dialog.tsx"), "utf-8");

describe("PriceConfirmationDialog — product identity", () => {
  it("accepts and shows the product name being reviewed", () => {
    expect(source).toContain("productName?: string");
    expect(source).toMatch(/<DialogDescription>\{productName\}<\/DialogDescription>/);
  });
});

describe("PriceConfirmationDialog — website status review", () => {
  it("accepts an optional website status change and shows old vs new status", () => {
    expect(source).toContain("websiteStatusChange?: WebsiteStatusChange | null");
    expect(source).toContain("Website status changing:");
    expect(source).toContain("websiteStatusChange.oldStatus");
    expect(source).toContain("websiteStatusChange.newStatus");
  });

  it("shows visibility before/after, not just the status enum", () => {
    expect(source).toContain("websiteStatusChange.oldVisible");
    expect(source).toContain("websiteStatusChange.newVisible");
  });
});

describe("PriceConfirmationDialog — changed/new variant indicator", () => {
  it("marks a row with no prior price as a new option rather than a price change", () => {
    expect(source).toContain('row.oldPriceBhd === undefined');
    expect(source).toContain("New option");
  });

  it("marks a row whose price differs from the prior save as Changed", () => {
    expect(source).toMatch(/priceChanged\s*=\s*row\.oldPriceBhd !== undefined && row\.oldPriceBhd !== price/);
    expect(source).toContain('variant="warning">Changed</Badge>');
  });
});

describe("PriceConfirmationDialog — cost breakdown fields (unchanged)", () => {
  it("still shows buying price, import cost, and final Bahrain cost per row", () => {
    for (const label of ["Buying India", "Import India", "Final cost Bahrain"]) {
      expect(source).toContain(label);
    }
  });

  it("still lets staff correct the final selling price per row", () => {
    expect(source).toContain("Selling price / Final customer price (BHD)");
  });
});

describe("PriceConfirmationDialog — root-cause fix: seeds from the CURRENT price, never the cost-derived suggestion", () => {
  // Real incident: editing unrelated product details (e.g. website status) silently replaced
  // the customer-facing selling price with a zero-profit cost figure, because this dialog
  // defaulted every price field to the calculated suggested price instead of what the product
  // was actually selling for. currentPriceBhd (seeded from the live form value — the real
  // stored price for an untouched variant) must be the seed, with suggestedPriceBhd only used
  // as a last-resort fallback for a brand-new variant that has no price yet.
  it("requires currentPriceBhd on every row", () => {
    expect(source).toContain("currentPriceBhd: number;");
  });

  it("seeds the editable price map from currentPriceBhd, not suggestedPriceBhd", () => {
    expect(source).toMatch(
      /row\.currentPriceBhd > 0 \? row\.currentPriceBhd : row\.suggestedPriceBhd/,
    );
  });

  it("the row-render fallback for an uninitialized price is also currentPriceBhd, not suggestedPriceBhd", () => {
    expect(source).toContain("prices[row.key] ?? row.currentPriceBhd");
    expect(source).not.toContain("prices[row.key] ?? row.suggestedPriceBhd");
  });

  it('shows "Selling price unchanged" when the price was not touched, reassuring staff cost edits are safe', () => {
    expect(source).toContain("Selling price unchanged at");
    expect(source).toContain("cost changes never affect");
    expect(source).toMatch(/!isNewVariant && !priceChanged &&/);
  });

  it('offers "Use suggested price" per row instead of auto-applying it', () => {
    expect(source).toContain("Use suggested price");
    expect(source).toContain("suggestionDiffersFromPrice");
    expect(source).toContain("[row.key]: row.suggestedPriceBhd");
  });
});
