"use server";

import { adjustStock, addStock } from "@/lib/services/inventory.service";
import type { StockAdjustmentInput, StockEntryInput } from "@/lib/validations/inventory.schema";

export async function addStockAction(input: StockEntryInput) {
  const result = await addStock(input);

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}

export async function adjustStockAction(input: StockAdjustmentInput) {
  const result = await adjustStock(input);

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}
