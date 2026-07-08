"use server";

import {
  updateDelivery,
  advanceDeliveryStatus,
  bulkDeliveryAction,
} from "@/lib/services/delivery.service";
import type { DeliveryUpdateInput } from "@/lib/validations/delivery.schema";
import type { DeliveryStatus } from "@/types/database";

export async function updateDeliveryAction(deliveryId: string, input: DeliveryUpdateInput) {
  const result = await updateDelivery(deliveryId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function advanceDeliveryStatusAction(
  deliveryId: string,
  newStatus: DeliveryStatus,
  reason?: string,
  note?: string,
  collectedAmount?: number,
) {
  const result = await advanceDeliveryStatus(
    deliveryId,
    newStatus,
    reason,
    note,
    collectedAmount,
  );

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}

export async function bulkDeliveryActionAction(
  deliveryIds: string[],
  newStatus: "packed" | "ready_for_pickup",
) {
  return bulkDeliveryAction(deliveryIds, newStatus);
}
