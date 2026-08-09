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
  /** Import cost per piece (cargo/customs/packing/transfer/delivery from India to Bahrain).
   *  Missing/null is treated as 0 — it never invalidates an otherwise-valid cost the way a
   *  missing INR price or rate does. Column name kept as-is (established before the "Import
   *  cost" label existed); only the user-facing wording changed. */
  latest_additional_landed_cost_bhd?: number | null;
};

export type ValidBuyingCost = {
  buyingPriceInr: number;
  exchangeRateToBhd: number;
  /** Import cost per piece (BHD) — optional, defaults to 0. */
  importCostBhd: number;
  /** buyingPriceInr × exchangeRateToBhd — always recalculated, never a stored value. */
  convertedUnitCostBhd: number;
  /** Final cost in Bahrain: convertedUnitCostBhd + importCostBhd — the cost basis for profit/margin. */
  finalUnitCostBhd: number;
};

/**
 * Returns the variant's buying cost only when the INR price and the exchange rate are both
 * present and greater than 0. Returns null (treat as "missing") otherwise — including when a
 * stored converted/landed BHD figure exists but the INR or rate behind it doesn't.
 *
 * The optional import cost is added on top when present and >= 0 (never negative, defaults to
 * 0) — it can never by itself make an otherwise-missing cost "valid", and it never makes an
 * otherwise-valid cost "invalid".
 */
export function getValidBuyingCost(variant: BuyingCostSource): ValidBuyingCost | null {
  const inr = variant.latest_supplier_unit_cost_inr;
  const rate = variant.latest_exchange_rate_to_bhd;

  if (inr === null || inr === undefined || inr <= 0) return null;
  if (rate === null || rate === undefined || rate <= 0) return null;

  const rawImportCost = variant.latest_additional_landed_cost_bhd;
  const importCostBhd =
    rawImportCost === null || rawImportCost === undefined || rawImportCost < 0
      ? 0
      : rawImportCost;

  const convertedUnitCostBhd = roundBhd(convertToBhd(inr, rate));
  const finalUnitCostBhd = roundBhd(convertedUnitCostBhd + importCostBhd);

  return {
    buyingPriceInr: inr,
    exchangeRateToBhd: rate,
    importCostBhd,
    convertedUnitCostBhd,
    finalUnitCostBhd,
  };
}

// ── UI-only cost status (Stock Management "View cost" simplification) ──────────
// getValidBuyingCost() stays the single calculation authority (recorded vs not). This adds
// a display-only refinement on top of the "not recorded" case: distinguishing a variant
// where nothing was ever entered ("missing") from one where partial/inconsistent data
// exists — e.g. an INR price with no exchange rate, or vice versa — which is worth flagging
// to staff as "invalid" so they know to go review it, rather than assuming it was simply
// never touched.

export type BuyingCostStatus = "recorded" | "missing" | "invalid";

export function getBuyingCostStatus(variant: BuyingCostSource): BuyingCostStatus {
  if (getValidBuyingCost(variant) !== null) return "recorded";

  const inr = variant.latest_supplier_unit_cost_inr;
  const rate = variant.latest_exchange_rate_to_bhd;
  const hasInr = inr !== null && inr !== undefined && inr > 0;
  const hasRate = rate !== null && rate !== undefined && rate > 0;

  return hasInr || hasRate ? "invalid" : "missing";
}

// ── product-level cost status badge (Product Catalog + Product Business Summary) ──
// A product's variants are aggregated into validCostCount/missingCostCount (see
// listProducts() in product.service.ts, which uses getValidBuyingCost() per variant).
// This decides the single badge shown for the whole product across three states:
//   - "Cost complete"      — every variant has a valid cost
//   - "Missing cost: X"    — some variants have a valid cost, X do not
//   - "Cost not recorded"  — no variant has a valid cost at all
// so staff never have to guess how many variants still need attention, and can tell "some
// missing" apart from "nothing entered yet" at a glance.

export type CostSummaryBadge = {
  variant: "success" | "warning" | "danger";
  label: string;
};

export function getCostSummaryBadge(validCount: number, missingCount: number): CostSummaryBadge {
  if (validCount === 0) {
    return { variant: "danger", label: "Cost not recorded" };
  }
  if (missingCount === 0) {
    return { variant: "success", label: "Cost complete" };
  }
  return { variant: "warning", label: `Missing cost: ${missingCount}` };
}

// ── Product Detail "Business summary" totals ────────────────────────────────────
// Shared by the Product Detail page's top Business summary card and its detailed Buying
// Cost table below, so both read from one computation instead of two. Profit/margin fields
// are always computed here — the caller (page component) decides whether to render them,
// based on canViewCostData(role). This function never gates by role; it only calculates.

export type ProductVariantCostInput = BuyingCostSource & {
  id: string;
  color: string;
  size: string;
  stock_quantity: number;
  selling_price: number;
  regular_selling_price_bhd: number | null;
};

export type ProductVariantCostRow = {
  variant: ProductVariantCostInput;
  cost: ValidBuyingCost | null;
  sellingBhd: number;
  profit: number | null;
  margin: number | null;
};

export type ProductCostSummary = {
  rows: ProductVariantCostRow[];
  validCostCount: number;
  missingCostCount: number;
  hasValidCost: boolean;
  totalBuyingValueInr: number;
  totalFinalCostBhd: number;
  totalSellingValueBhd: number;
  estimatedGrossProfit: number;
  estimatedMarginPercent: number | null;
};

export function computeProductCostSummary(
  variants: ProductVariantCostInput[],
): ProductCostSummary {
  const rows: ProductVariantCostRow[] = variants.map((variant) => {
    const cost = getValidBuyingCost(variant);
    const sellingBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);
    const profit = cost ? calcEstimatedProfit(sellingBhd, cost.finalUnitCostBhd) : null;
    const margin = cost ? calcEstimatedMargin(sellingBhd, cost.finalUnitCostBhd) : null;
    return { variant, cost, sellingBhd, profit, margin };
  });

  const validCostCount = rows.filter((r) => r.cost !== null).length;
  const missingCostCount = rows.length - validCostCount;
  const hasValidCost = validCostCount > 0;

  const totalBuyingValueInr = rows.reduce(
    (sum, r) => sum + (r.cost ? r.cost.buyingPriceInr * r.variant.stock_quantity : 0),
    0,
  );
  const totalFinalCostBhd = rows.reduce(
    (sum, r) => sum + (r.cost ? r.cost.finalUnitCostBhd * r.variant.stock_quantity : 0),
    0,
  );
  const totalSellingValueBhd = rows.reduce(
    (sum, r) => sum + (r.cost ? r.sellingBhd * r.variant.stock_quantity : 0),
    0,
  );
  const estimatedGrossProfit = totalSellingValueBhd - totalFinalCostBhd;
  const estimatedMarginPercent = hasValidCost
    ? calcEstimatedMargin(totalSellingValueBhd, totalFinalCostBhd)
    : null;

  return {
    rows,
    validCostCount,
    missingCostCount,
    hasValidCost,
    totalBuyingValueInr,
    totalFinalCostBhd,
    totalSellingValueBhd,
    estimatedGrossProfit,
    estimatedMarginPercent,
  };
}
