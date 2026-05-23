"use server";

import { updateDelivery } from "@/lib/services/delivery.service";
import type { DeliveryUpdateInput } from "@/lib/validations/delivery.schema";

export async function updateDeliveryAction(deliveryId: string, input: DeliveryUpdateInput) {
  const result = await updateDelivery(deliveryId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
