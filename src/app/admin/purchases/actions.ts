"use server";

import { createPurchase, receivePurchase } from "@/lib/services/purchase.service";
import type { PurchaseInput } from "@/lib/validations/purchase.schema";

export async function createPurchaseAction(input: PurchaseInput) {
  const result = await createPurchase(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function receivePurchaseAction(purchaseId: string) {
  const result = await receivePurchase(purchaseId);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}

export async function receivePurchaseFormAction(purchaseId: string) {
  await receivePurchase(purchaseId);
}
