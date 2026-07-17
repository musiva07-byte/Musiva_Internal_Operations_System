/**
 * INR → BHD cost conversion helpers.
 *
 * Exchange rate convention used throughout this module:
 *   exchangeRateToBhd = 1 supplier-currency unit expressed in BHD (multiply direction).
 *   Example: 1 INR = 0.004520 BHD  →  exchangeRateToBhd = 0.004520
 *   converted_bhd = supplierAmount × exchangeRateToBhd
 *
 * Note: The purchase module (purchase.schema.ts / receive_purchase_order SQL function)
 * uses the INVERSE convention (INR per BHD = divide direction, e.g., 221.24). When
 * creating opening-stock inventory batches the rate is stored here, in the multiply
 * direction, and the batch_type column marks the row as 'opening_stock' so future
 * reporting queries know which convention applies.
 */

/** Convert a supplier-currency amount to BHD.
 *  @param supplierAmount  Amount in supplier currency (e.g., INR).
 *  @param exchangeRateToBhd  1 supplier-currency unit in BHD (e.g., 0.00452).
 */
export function convertToBhd(supplierAmount: number, exchangeRateToBhd: number): number {
  if (exchangeRateToBhd <= 0) return 0;
  return supplierAmount * exchangeRateToBhd;
}

/** Estimated gross profit per piece (selling price minus buying price in BHD). No import
 *  cost is added — the buying-cost workflow only converts currency, nothing else. */
export function calcEstimatedProfit(sellingPriceBhd: number, buyingPriceBhd: number): number {
  return sellingPriceBhd - buyingPriceBhd;
}

/** Estimated gross margin as a percentage (0–100).
 *  Returns null when selling price is 0 (division by zero guard). */
export function calcEstimatedMargin(sellingPriceBhd: number, buyingPriceBhd: number): number | null {
  if (sellingPriceBhd <= 0) return null;
  return ((sellingPriceBhd - buyingPriceBhd) / sellingPriceBhd) * 100;
}

/** Round a BHD amount to 3 decimal places (Bahraini Dinar standard). */
export function roundBhd(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Format INR amount with ₹ symbol and 2 decimal places. */
export function formatInr(value: number): string {
  return `₹${value.toFixed(2)}`;
}

// ── centralized buying-cost validity ─────────────────────────────────────────
// This is the ONE place that decides whether a variant's buying cost can be trusted.
//
// Why this exists: product_variants.latest_landed_cost_bhd / average_landed_cost_bhd are
// ALSO written by the unrelated Purchase Order flow (receive_purchase_order SQL function),
// which uses its own convention and can carry bad/legacy data (e.g. an unconverted INR
// figure entered as if it were already BHD). Summing those columns directly has produced
// impossible dashboard totals (BHD millions, negative margins in the millions of percent).
// latest_supplier_unit_cost_inr / latest_exchange_rate_to_bhd are ONLY ever written by this
// product-creation buying-cost workflow, so they're the only trustworthy source — buying
// price BHD is always recalculated fresh from them (INR × rate), never read from a stored
// BHD column.

export type BuyingCostSource = {
  latest_supplier_unit_cost_inr: number | null;
  latest_exchange_rate_to_bhd: number | null;
};

export type ValidBuyingCost = {
  buyingPriceInr: number;
  exchangeRateToBhd: number;
  /** Always recalculated as buyingPriceInr × exchangeRateToBhd — never a stored value. */
  buyingPriceBhd: number;
};

/**
 * Returns the variant's buying cost only when both the INR price and the exchange rate
 * are present and greater than 0. Returns null (treat as "missing") otherwise — including
 * when a stored converted/landed BHD figure exists but the INR or rate behind it doesn't.
 */
export function getValidBuyingCost(variant: BuyingCostSource): ValidBuyingCost | null {
  const inr = variant.latest_supplier_unit_cost_inr;
  const rate = variant.latest_exchange_rate_to_bhd;

  if (inr === null || inr === undefined || inr <= 0) return null;
  if (rate === null || rate === undefined || rate <= 0) return null;

  return {
    buyingPriceInr: inr,
    exchangeRateToBhd: rate,
    buyingPriceBhd: roundBhd(convertToBhd(inr, rate)),
  };
}
