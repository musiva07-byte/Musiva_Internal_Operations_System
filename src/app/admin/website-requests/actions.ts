"use server";

import { updateWebsiteRequestStatus } from "@/lib/services/website-request.service";
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
