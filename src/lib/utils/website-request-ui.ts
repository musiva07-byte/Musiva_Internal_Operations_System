import { canDecideWebsiteRequest } from "@/lib/auth/permissions";
import type { StaffRole } from "@/lib/constants";
import type { WebsiteOrderRequestStatus } from "@/types/database";

/** Only "cancelled" is destructive/hard-to-undo enough to require an inline confirm step. */
export function requiresConfirmation(targetStatus: WebsiteOrderRequestStatus): boolean {
  return targetStatus === "cancelled";
}

/**
 * Cosmetic, non-authoritative helper text shown next to the action buttons for a request.
 * Real permission is always enforced by getAllowedNextStatuses() / the server — this only
 * explains *why* a staff member without decision rights sees no Confirm/Cancel buttons.
 */
export function getStatusHelperNote(
  status: WebsiteOrderRequestStatus,
  role: StaffRole | null | undefined,
): string | null {
  if (canDecideWebsiteRequest(role)) return null;

  if (status === "contacted") return "Waiting for manager confirmation";
  if (status === "confirmed") return "Ready for Convert to Order";
  return null;
}

/** Owner/manager see a "Convert to Order" placeholder once a request is confirmed. */
export function showConvertToOrderPlaceholder(
  status: WebsiteOrderRequestStatus,
  role: StaffRole | null | undefined,
): boolean {
  return status === "confirmed" && canDecideWebsiteRequest(role);
}

/**
 * Buttons to actually render for a status transition. This filters out transitions that the
 * server would still technically permit but which this unit's workflow doesn't surface as a
 * button — e.g. cancelling an already-confirmed request is hidden here in favor of the
 * upcoming "Convert to Order" action. The server-side state machine and permission checks in
 * website-request.service.ts are unchanged and remain the real authority either way.
 */
export function getVisibleNextStatuses(
  status: WebsiteOrderRequestStatus,
  allowedNextStatuses: WebsiteOrderRequestStatus[],
): WebsiteOrderRequestStatus[] {
  if (status === "confirmed") {
    return allowedNextStatuses.filter((next) => next !== "cancelled");
  }
  return allowedNextStatuses;
}
