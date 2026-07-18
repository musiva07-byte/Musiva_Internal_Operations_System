"use server";

import {
  convertWebsiteRequestToOrder,
  updateWebsiteRequestStatus,
} from "@/lib/services/website-request.service";
import type { WebsiteOrderRequestStatus } from "@/types/database";

export async function updateWebsiteRequestStatusAction(
  requestId: string,
  newStatus: WebsiteOrderRequestStatus,
) {
  const result = await updateWebsiteRequestStatus(requestId, newStatus);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}

export async function convertWebsiteRequestToOrderAction(requestId: string) {
  const result = await convertWebsiteRequestToOrder(requestId);

  if (result.error || !result.data) {
    return { ok: false as const, error: result.error, orderId: null, orderNumber: null };
  }

  return {
    ok: true as const,
    error: null,
    orderId: result.data.orderId,
    orderNumber: result.data.orderNumber,
  };
}
