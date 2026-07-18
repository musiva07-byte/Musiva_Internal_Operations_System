import { canDecideWebsiteRequest, canManageOrders } from "@/lib/auth/permissions";
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
 *
 * The "confirmed" note is only shown to staff who cannot actually convert the request
 * (canManageOrders) — anyone who can convert sees the real Convert to Order button instead
 * (see ConvertToOrderButton), so the two never appear together.
 */
export function getStatusHelperNote(
  status: WebsiteOrderRequestStatus,
  role: StaffRole | null | undefined,
): string | null {
  if (status === "contacted" && !canDecideWebsiteRequest(role)) {
    return "Waiting for manager confirmation";
  }
  if (status === "confirmed" && !canManageOrders(role)) {
    return "Ready for Convert to Order";
  }
  return null;
}

export type ConvertToOrderViewState =
  | "converted"
  | "cancelled"
  | "needs_confirmation"
  | "no_permission"
  | "ready";

/**
 * Pure decision table for what the Convert to Order button/panel should show. Extracted so
 * the exact visibility rules (item 1 of Unit 2G) are unit-testable without a component-
 * testing library — ConvertToOrderButton just renders whichever state this returns.
 *
 *   converted          -> already converted; show the linked order, never a button
 *   cancelled          -> cancelled requests can never be converted; show nothing
 *   needs_confirmation -> new/contacted; show the "confirm first" note
 *   no_permission      -> confirmed, but this viewer cannot convert; show nothing
 *   ready              -> confirmed, unconverted, permitted; show the real button
 */
export function getConvertToOrderViewState(
  status: WebsiteOrderRequestStatus,
  canConvert: boolean,
  convertedOrderId: string | null,
): ConvertToOrderViewState {
  if (convertedOrderId) return "converted";
  if (status === "cancelled") return "cancelled";
  if (status !== "confirmed") return "needs_confirmation";
  if (!canConvert) return "no_permission";
  return "ready";
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
