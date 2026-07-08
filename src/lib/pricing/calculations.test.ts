import { describe, expect, it } from "vitest";
import {
  allocateImportCostProportional,
  calculateGrossMarginPercent,
  calculateGrossProfit,
  calculateLandedUnitCost,
  calculateWeightedAverageCost,
  getActiveSellingPrice,
  getPricingStatus,
  getStockStatus,
  isDiscountActive,
  sumImportCosts,
  supplierAmountToBhd,
} from "./calculations";

// ── INR to BHD conversion ──────────────────────────────────────────────────────

describe("supplierAmountToBhd", () => {
  it("converts INR to BHD correctly", () => {
    // 1 BHD = 100 INR → 1500 INR = 15 BHD
    expect(supplierAmountToBhd(1500, 100)).toBe(15);
  });

  it("rounds to 3 decimal places", () => {
    // 1500 / 97 = 15.46391…
    expect(supplierAmountToBhd(1500, 97)).toBe(15.464);
  });

  it("returns 0 when rate is 0", () => {
    expect(supplierAmountToBhd(1000, 0)).toBe(0);
  });

  it("returns 0 when rate is negative", () => {
    expect(supplierAmountToBhd(1000, -1)).toBe(0);
  });

  it("returns 0 when supplier amount is 0", () => {
    expect(supplierAmountToBhd(0, 100)).toBe(0);
  });
});

// ── Import cost summation ──────────────────────────────────────────────────────

describe("sumImportCosts", () => {
  it("sums all import cost components", () => {
    expect(
      sumImportCosts({
        shippingCostBhd: 5,
        customsCostBhd: 2,
        bankFeeBhd: 0.5,
        packagingCostBhd: 1,
        otherImportCostBhd: 0.5,
      }),
    ).toBe(9);
  });

  it("returns 0 when all costs are 0", () => {
    expect(
      sumImportCosts({
        shippingCostBhd: 0,
        customsCostBhd: 0,
        bankFeeBhd: 0,
        packagingCostBhd: 0,
        otherImportCostBhd: 0,
      }),
    ).toBe(0);
  });
});

// ── Proportional import cost allocation ───────────────────────────────────────

describe("allocateImportCostProportional", () => {
  it("allocates proportionally by item value", () => {
    // item = BHD 30, total = BHD 100, import = BHD 10 → item gets BHD 3
    expect(allocateImportCostProportional(30, 100, 10)).toBe(3);
  });

  it("returns 0 when total converted value is 0", () => {
    expect(allocateImportCostProportional(30, 0, 10)).toBe(0);
  });

  it("returns 0 when import cost is 0", () => {
    expect(allocateImportCostProportional(30, 100, 0)).toBe(0);
  });

  it("allocates full import cost when item is the only item", () => {
    expect(allocateImportCostProportional(100, 100, 10)).toBe(10);
  });

  it("rounds to 3 decimal places", () => {
    // 1 / 3 of 10 = 3.333…
    expect(allocateImportCostProportional(10, 30, 10)).toBe(3.333);
  });
});

// ── Landed unit cost calculation ───────────────────────────────────────────────

describe("calculateLandedUnitCost", () => {
  it("adds converted cost and allocated import cost", () => {
    expect(calculateLandedUnitCost(15, 3)).toBe(18);
  });

  it("rounds to 3 decimal places", () => {
    expect(calculateLandedUnitCost(15.464, 3.333)).toBe(18.797);
  });
});

// ── Weighted average landed cost ───────────────────────────────────────────────

describe("calculateWeightedAverageCost", () => {
  it("calculates weighted average from multiple batches", () => {
    const batches = [
      { landed_unit_cost_bhd: 10, quantity_received: 5 }, // 50
      { landed_unit_cost_bhd: 20, quantity_received: 5 }, // 100
    ];
    // (50 + 100) / 10 = 15
    expect(calculateWeightedAverageCost(batches)).toBe(15);
  });

  it("returns null for empty batches", () => {
    expect(calculateWeightedAverageCost([])).toBeNull();
  });

  it("ignores batches with null landed cost", () => {
    const batches = [
      { landed_unit_cost_bhd: null, quantity_received: 10 },
      { landed_unit_cost_bhd: 20, quantity_received: 5 },
    ];
    expect(calculateWeightedAverageCost(batches)).toBe(20);
  });

  it("ignores batches with zero quantity", () => {
    const batches = [
      { landed_unit_cost_bhd: 100, quantity_received: 0 },
      { landed_unit_cost_bhd: 20, quantity_received: 5 },
    ];
    expect(calculateWeightedAverageCost(batches)).toBe(20);
  });

  it("returns null when all batches have null cost or zero quantity", () => {
    expect(
      calculateWeightedAverageCost([
        { landed_unit_cost_bhd: null, quantity_received: 5 },
        { landed_unit_cost_bhd: 10, quantity_received: 0 },
      ]),
    ).toBeNull();
  });

  it("preserves historical snapshot even after new batches arrive", () => {
    // First receive: 10 units @ BHD 8
    const after_first = [{ landed_unit_cost_bhd: 8, quantity_received: 10 }];
    expect(calculateWeightedAverageCost(after_first)).toBe(8);

    // Second receive: 10 more @ BHD 10 — average should shift
    const after_second = [
      { landed_unit_cost_bhd: 8, quantity_received: 10 },
      { landed_unit_cost_bhd: 10, quantity_received: 10 },
    ];
    expect(calculateWeightedAverageCost(after_second)).toBe(9);
  });
});

// ── Discount active check ──────────────────────────────────────────────────────

const regularVariant = {
  regular_selling_price_bhd: 15,
  selling_price: 15,
  discount_price_bhd: null,
  discount_start_at: null,
  discount_end_at: null,
};

const saleVariant = {
  regular_selling_price_bhd: 15,
  selling_price: 15,
  discount_price_bhd: 10,
  discount_start_at: null,
  discount_end_at: null,
};

describe("isDiscountActive", () => {
  it("returns false when no discount price", () => {
    expect(isDiscountActive(regularVariant)).toBe(false);
  });

  it("returns true when discount has no date range", () => {
    expect(isDiscountActive(saleVariant)).toBe(true);
  });

  it("returns false when discount has not started yet", () => {
    const now = new Date("2026-07-01");
    const variant = { ...saleVariant, discount_start_at: "2026-08-01", discount_end_at: null };
    expect(isDiscountActive(variant, now)).toBe(false);
  });

  it("returns true when discount has started and not ended", () => {
    const now = new Date("2026-07-05");
    const variant = {
      ...saleVariant,
      discount_start_at: "2026-07-01",
      discount_end_at: "2026-07-31",
    };
    expect(isDiscountActive(variant, now)).toBe(true);
  });

  it("returns false when discount has ended", () => {
    const now = new Date("2026-08-01");
    const variant = {
      ...saleVariant,
      discount_start_at: "2026-07-01",
      discount_end_at: "2026-07-31",
    };
    expect(isDiscountActive(variant, now)).toBe(false);
  });

  it("returns false when discount price >= regular price", () => {
    const variant = { ...regularVariant, discount_price_bhd: 15 };
    expect(isDiscountActive(variant)).toBe(false);
  });

  it("falls back to selling_price when regular_selling_price_bhd is null", () => {
    const variant = {
      regular_selling_price_bhd: null,
      selling_price: 15,
      discount_price_bhd: 10,
      discount_start_at: null,
      discount_end_at: null,
    };
    expect(isDiscountActive(variant)).toBe(true);
  });
});

// ── Active selling price ───────────────────────────────────────────────────────

describe("getActiveSellingPrice", () => {
  it("returns regular price when no discount", () => {
    expect(getActiveSellingPrice(regularVariant)).toBe(15);
  });

  it("returns discount price when discount is active", () => {
    expect(getActiveSellingPrice(saleVariant)).toBe(10);
  });

  it("returns regular price when discount is scheduled in future", () => {
    const now = new Date("2026-07-01");
    const variant = { ...saleVariant, discount_start_at: "2026-08-01" };
    expect(getActiveSellingPrice(variant, now)).toBe(15);
  });

  it("returns regular price when discount period has ended", () => {
    const now = new Date("2026-09-01");
    const variant = {
      ...saleVariant,
      discount_start_at: "2026-07-01",
      discount_end_at: "2026-07-31",
    };
    expect(getActiveSellingPrice(variant, now)).toBe(15);
  });
});

// ── Pricing status ─────────────────────────────────────────────────────────────

describe("getPricingStatus", () => {
  it("returns regular when no discount price", () => {
    expect(getPricingStatus(regularVariant)).toBe("regular");
  });

  it("returns on_sale when discount is active with no date range", () => {
    expect(getPricingStatus(saleVariant)).toBe("on_sale");
  });

  it("returns discount_scheduled when discount starts in the future", () => {
    const now = new Date("2026-07-01");
    const variant = { ...saleVariant, discount_start_at: "2026-08-01" };
    expect(getPricingStatus(variant, now)).toBe("discount_scheduled");
  });

  it("returns discount_ended when discount end date has passed", () => {
    const now = new Date("2026-09-01");
    const variant = {
      ...saleVariant,
      discount_start_at: "2026-07-01",
      discount_end_at: "2026-07-31",
    };
    expect(getPricingStatus(variant, now)).toBe("discount_ended");
  });

  it("returns regular when discount_price >= regular_price", () => {
    const variant = { ...regularVariant, discount_price_bhd: 20 };
    expect(getPricingStatus(variant)).toBe("regular");
  });
});

// ── Stock status ───────────────────────────────────────────────────────────────

describe("getStockStatus", () => {
  it("returns out_of_stock when quantity is 0", () => {
    expect(getStockStatus(0, 5)).toBe("out_of_stock");
  });

  it("returns low_stock when quantity equals minimum", () => {
    expect(getStockStatus(5, 5)).toBe("low_stock");
  });

  it("returns low_stock when quantity is below minimum", () => {
    expect(getStockStatus(2, 5)).toBe("low_stock");
  });

  it("returns in_stock when quantity exceeds minimum", () => {
    expect(getStockStatus(10, 5)).toBe("in_stock");
  });

  it("returns in_stock when minimum is 0 and quantity > 0", () => {
    expect(getStockStatus(1, 0)).toBe("in_stock");
  });
});

// ── Gross profit and margin ───────────────────────────────────────────────────

describe("calculateGrossProfit", () => {
  it("calculates profit correctly", () => {
    expect(calculateGrossProfit(15, 8)).toBe(7);
  });

  it("returns null when cost basis is null", () => {
    expect(calculateGrossProfit(15, null)).toBeNull();
  });

  it("returns negative profit when selling below cost", () => {
    expect(calculateGrossProfit(5, 8)).toBe(-3);
  });
});

describe("calculateGrossMarginPercent", () => {
  it("calculates margin percentage correctly", () => {
    // (15 - 8) / 15 × 100 = 46.667
    expect(calculateGrossMarginPercent(15, 8)).toBe(46.667);
  });

  it("returns null when cost basis is null", () => {
    expect(calculateGrossMarginPercent(15, null)).toBeNull();
  });

  it("returns null when selling price is 0", () => {
    expect(calculateGrossMarginPercent(0, 8)).toBeNull();
  });

  it("returns 0 margin when selling at cost", () => {
    expect(calculateGrossMarginPercent(10, 10)).toBe(0);
  });
});
