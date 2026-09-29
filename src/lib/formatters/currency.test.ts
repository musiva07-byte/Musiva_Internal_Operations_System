import { describe, it, expect } from "vitest";
import { formatBhd, formatCatalogPriceRange } from "./currency";

describe("formatCatalogPriceRange — Product Catalog price column", () => {
  it("shows the plain price when every active variant shares the same price", () => {
    expect(formatCatalogPriceRange(13, 13)).toBe(formatBhd(13));
  });

  it('shows "From BHD X.XXX" (lowest active price) when variants have different prices', () => {
    expect(formatCatalogPriceRange(9, 13)).toBe(`From ${formatBhd(9)}`);
  });

  it("never shows the highest price as the headline figure", () => {
    const result = formatCatalogPriceRange(9, 13);
    expect(result).not.toContain(formatBhd(13));
  });

  it('shows "—" when there is no active-priced variant at all', () => {
    expect(formatCatalogPriceRange(null, null)).toBe("—");
  });

  it("treats a single-variant product (min === max) as a plain price, not a range", () => {
    expect(formatCatalogPriceRange(7.605, 7.605)).toBe("BHD 7.605");
  });
});
