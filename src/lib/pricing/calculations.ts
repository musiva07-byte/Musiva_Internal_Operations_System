import type { PricingStatus, StockStatus } from "@/types/database";

// ── helpers ───────────────────────────────────────────────────────────────────

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ── currency conversion ───────────────────────────────────────────────────────

/**
 * Convert a supplier amount (e.g. INR) to BHD using the saved exchange rate.
 * Exchange rate is expressed as:  1 BHD = N supplier-currency units
 * i.e.  exchangeRate = INR per 1 BHD  →  BHD = INR / exchangeRate
 */
export function supplierAmountToBhd(
  supplierAmount: number,
  exchangeRateInrPerBhd: number,
): number {
  if (exchangeRateInrPerBhd <= 0) return 0;
  return round3(supplierAmount / exchangeRateInrPerBhd);
}

// ── import cost allocation ────────────────────────────────────────────────────

/** Total import cost = shipping + customs + bank fees + packaging + other. */
export function sumImportCosts(costs: {
  shippingCostBhd: number;
  customsCostBhd: number;
  bankFeeBhd: number;
  packagingCostBhd: number;
  otherImportCostBhd: number;
}): number {
  return round3(
    costs.shippingCostBhd +
      costs.customsCostBhd +
      costs.bankFeeBhd +
      costs.packagingCostBhd +
      costs.otherImportCostBhd,
  );
}

/**
 * Proportional allocation by converted BHD value.
 * Each item absorbs (itemValue / totalValue) of the total import cost.
 */
export function allocateImportCostProportional(
  itemConvertedBhd: number,
  totalConvertedBhd: number,
  totalImportCostBhd: number,
): number {
  if (totalConvertedBhd <= 0 || totalImportCostBhd <= 0) return 0;
  return round3((itemConvertedBhd / totalConvertedBhd) * totalImportCostBhd);
}

/** Landed unit cost = converted BHD cost + allocated import cost share. */
export function calculateLandedUnitCost(
  convertedUnitCostBhd: number,
  allocatedImportCostBhd: number,
): number {
  return round3(convertedUnitCostBhd + allocatedImportCostBhd);
}

// ── weighted average landed cost ───────────────────────────────────���─────────

export type CostBatch = {
  landed_unit_cost_bhd: number | null;
  quantity_received: number;
};

/**
 * Weighted average landed cost across all received batches that have a landed cost.
 * Returns null when no valid batches exist.
 */
export function calculateWeightedAverageCost(batches: CostBatch[]): number | null {
  const valid = batches.filter(
    (b) => b.landed_unit_cost_bhd !== null && b.quantity_received > 0,
  );
  if (valid.length === 0) return null;

  const totalValue = valid.reduce(
    (sum, b) => sum + b.landed_unit_cost_bhd! * b.quantity_received,
    0,
  );
  const totalQty = valid.reduce((sum, b) => sum + b.quantity_received, 0);
  return totalQty > 0 ? round3(totalValue / totalQty) : null;
}

// ── selling price ─────────────────────────────────────────────────────────────

export type VariantPricingFields = {
  regular_selling_price_bhd: number | null;
  /** @deprecated fallback only */
  selling_price: number;
  discount_price_bhd: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
};

/** Regular price, preferring the new field with a fallback to the old one. */
export function getRegularPrice(variant: Pick<VariantPricingFields, "regular_selling_price_bhd" | "selling_price">): number {
  return variant.regular_selling_price_bhd ?? variant.selling_price;
}

/** Returns true when a discount is currently active. */
export function isDiscountActive(variant: VariantPricingFields, now = new Date()): boolean {
  const regular = getRegularPrice(variant);
  const discount = variant.discount_price_bhd;
  if (discount === null || discount === undefined || discount >= regular) return false;

  const afterStart = !variant.discount_start_at || new Date(variant.discount_start_at) <= now;
  const beforeEnd = !variant.discount_end_at || new Date(variant.discount_end_at) >= now;
  return afterStart && beforeEnd;
}

/** The price a customer actually pays right now. */
export function getActiveSellingPrice(variant: VariantPricingFields, now = new Date()): number {
  if (isDiscountActive(variant, now)) return variant.discount_price_bhd!;
  return getRegularPrice(variant);
}

// ── pricing status ────────────────────────────────────────────────────────────

export function getPricingStatus(variant: VariantPricingFields, now = new Date()): PricingStatus {
  const regular = getRegularPrice(variant);
  const discount = variant.discount_price_bhd;

  if (discount === null || discount === undefined || discount >= regular) return "regular";

  const start = variant.discount_start_at ? new Date(variant.discount_start_at) : null;
  const end = variant.discount_end_at ? new Date(variant.discount_end_at) : null;

  if (start && start > now) return "discount_scheduled";
  if (end && end < now) return "discount_ended";
  return "on_sale";
}

// ── stock status ──────────────────────────────────────────────────────────────

export function getStockStatus(quantity: number, minimum: number): StockStatus {
  if (quantity === 0) return "out_of_stock";
  if (quantity <= minimum) return "low_stock";
  return "in_stock";
}

// ── gross profit ──────────────────────────────────────────────────────────────

export function calculateGrossProfit(
  sellingPrice: number,
  costBasis: number | null,
): number | null {
  if (costBasis === null) return null;
  return round3(sellingPrice - costBasis);
}

export function calculateGrossMarginPercent(
  sellingPrice: number,
  costBasis: number | null,
): number | null {
  if (costBasis === null || sellingPrice <= 0) return null;
  return round3(((sellingPrice - costBasis) / sellingPrice) * 100);
}
