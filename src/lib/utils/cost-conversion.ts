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

/** Final landed cost per piece in BHD.
 *  @param convertedBhd  Buying price already converted to BHD.
 *  @param extraImportCostBhd  Additional import costs per piece (shipping, customs, etc.).
 */
export function calcLandedCost(convertedBhd: number, extraImportCostBhd: number): number {
  return convertedBhd + extraImportCostBhd;
}

/** Estimated gross profit per piece (selling price minus landed cost). */
export function calcEstimatedProfit(sellingPriceBhd: number, landedCostBhd: number): number {
  return sellingPriceBhd - landedCostBhd;
}

/** Estimated gross margin as a percentage (0–100).
 *  Returns null when selling price is 0 (division by zero guard). */
export function calcEstimatedMargin(sellingPriceBhd: number, landedCostBhd: number): number | null {
  if (sellingPriceBhd <= 0) return null;
  return ((sellingPriceBhd - landedCostBhd) / sellingPriceBhd) * 100;
}

/** Round a BHD amount to 3 decimal places (Bahraini Dinar standard). */
export function roundBhd(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Format INR amount with ₹ symbol and 2 decimal places. */
export function formatInr(value: number): string {
  return `₹${value.toFixed(2)}`;
}
