import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import {
  canContactWebsiteRequest,
  canDecideWebsiteRequest,
  canReopenWebsiteRequest,
  canViewWebsiteRequests,
} from "@/lib/auth/permissions";
import { WEBSITE_REQUEST_NEXT_STATUSES } from "@/lib/constants/statuses";
import {
  websiteRequestStatusUpdateSchema,
} from "@/lib/validations/website-request.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { WebsiteOrderRequestRow, WebsiteOrderRequestStatus } from "@/types/database";
import type { PaginatedResult, WebsiteRequestTabCounts } from "@/types/app";
import type { StaffRole } from "@/lib/constants";

const PAGE_SIZE = 25;
const LOAD_ERROR = "Unable to load website requests. Please try again or contact the administrator.";

type WebsiteRequestFilters = {
  q?: string;
  /** One of: new | contacted | confirmed | cancelled | all */
  tab?: string;
  page?: number;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

/** Which permission predicate governs a given status transition. */
function permissionForTransition(current: WebsiteOrderRequestStatus, next: WebsiteOrderRequestStatus) {
  if (current === "cancelled" && next === "new") {
    return canReopenWebsiteRequest;
  }
  if (next === "confirmed" || next === "cancelled") {
    return canDecideWebsiteRequest;
  }
  return canContactWebsiteRequest;
}

/**
 * Pure helper for the detail page: which next statuses should be offered to this role.
 * Display-only — updateWebsiteRequestStatus() re-checks permission server-side regardless,
 * so this never becomes the actual security boundary.
 */
export function getAllowedNextStatuses(
  currentStatus: WebsiteOrderRequestStatus,
  role: StaffRole | null | undefined,
): WebsiteOrderRequestStatus[] {
  const candidates = (WEBSITE_REQUEST_NEXT_STATUSES[currentStatus] ?? []) as WebsiteOrderRequestStatus[];
  return candidates.filter((next) => permissionForTransition(currentStatus, next)(role));
}

/**
 * Enriches a page of website request rows with the allowed-next-statuses for this viewer's
 * role, computed once server-side so the card/table UI can render its per-row action buttons
 * without importing this service module (which pulls in server-only Supabase client code).
 */
export function withAllowedNextStatuses<T extends { status: WebsiteOrderRequestStatus }>(
  rows: T[],
  role: StaffRole | null | undefined,
): (T & { allowedNextStatuses: WebsiteOrderRequestStatus[] })[] {
  return rows.map((row) => ({ ...row, allowedNextStatuses: getAllowedNextStatuses(row.status, role) }));
}

export async function listWebsiteRequests(
  filters: WebsiteRequestFilters = {},
): Promise<PaginatedResult<WebsiteOrderRequestRow>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("website_order_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const tab = filters.tab ?? "new";
  if (tab !== "all") {
    query = query.eq("status", tab as WebsiteOrderRequestStatus);
  }

  const search = filters.q?.trim();
  if (search) {
    // Public-facing search box on an internal page — strip characters that would break
    // out of the PostgREST .or() filter syntax, same guard used on the ecommerce website's
    // own public search (lib/services/products.ts there).
    const safe = search.replace(/[%,()]/g, "");
    query = query.or(
      [
        `request_number.ilike.%${safe}%`,
        `customer_name.ilike.%${safe}%`,
        `mobile_display.ilike.%${safe}%`,
        `whatsapp_display.ilike.%${safe}%`,
        `product_name_snapshot.ilike.%${safe}%`,
      ].join(","),
    );
  }

  const { data, count, error } = await query;
  if (error) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function listWebsiteRequestTabCounts(): Promise<WebsiteRequestTabCounts> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { new: 0, contacted: 0, confirmed: 0, cancelled: 0, all: 0 };
  }

  const [newRes, contactedRes, confirmedRes, cancelledRes, allRes] = await Promise.all([
    supabase.from("website_order_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("website_order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "contacted"),
    supabase
      .from("website_order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase
      .from("website_order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled"),
    supabase.from("website_order_requests").select("*", { count: "exact", head: true }),
  ]);

  return {
    new: newRes.count ?? 0,
    contacted: contactedRes.count ?? 0,
    confirmed: confirmedRes.count ?? 0,
    cancelled: cancelledRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}

export async function getWebsiteRequest(requestId: string): Promise<WebsiteOrderRequestRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("website_order_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  return data ?? null;
}

export async function updateWebsiteRequestStatus(
  requestId: string,
  newStatus: WebsiteOrderRequestStatus,
): Promise<ServiceResult<WebsiteOrderRequestRow>> {
  const parsed = websiteRequestStatusUpdateSchema.safeParse({ status: newStatus });
  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canViewWebsiteRequests, "manage website requests");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: currentRow, error: currentError } = await auth.supabase
    .from("website_order_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  if (currentError || !currentRow) {
    return serviceError("Website request not found.");
  }

  const currentStatus = currentRow.status;
  const allowedNext = WEBSITE_REQUEST_NEXT_STATUSES[currentStatus] ?? [];
  if (!allowedNext.includes(parsed.data.status)) {
    return serviceError(
      `This request cannot move from "${currentStatus}" to "${parsed.data.status}".`,
    );
  }

  const permission = permissionForTransition(currentStatus, parsed.data.status);
  if (!permission(auth.role)) {
    return serviceError("You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase
    .from("website_order_requests")
    .update({ status: parsed.data.status })
    .eq("id", requestId)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Website request could not be updated.");
  }

  await createAuditLog({
    action: "update_website_request_status",
    tableName: "website_order_requests",
    recordId: requestId,
    userId: auth.userId,
    metadata: { from_status: currentStatus, to_status: parsed.data.status },
  });

  revalidatePath("/admin/website-requests");
  revalidatePath(`/admin/website-requests/${requestId}`);
  revalidatePath("/admin/dashboard");
  return serviceSuccess(data);
}
