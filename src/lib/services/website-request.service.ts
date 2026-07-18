import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import {
  canContactWebsiteRequest,
  canDecideWebsiteRequest,
  canManageOrders,
  canReopenWebsiteRequest,
  canViewWebsiteRequests,
} from "@/lib/auth/permissions";
import { WEBSITE_REQUEST_NEXT_STATUSES } from "@/lib/constants/statuses";
import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_STATUSES, FULFILMENT_METHODS } from "@/lib/constants";
import { BAHRAIN_GOVERNORATES } from "@/lib/constants/bahrain";
import {
  websiteRequestStatusUpdateSchema,
} from "@/lib/validations/website-request.schema";
import { createAuditLog } from "./audit.service";
import { findOrCreateCustomer } from "./customer.service";
import { createOrder, cancelOrder } from "./order.service";
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

// ─── Convert to Order (Unit 2G) ────────────────────────────────────────────────

export type ConvertToOrderResult = {
  orderId: string;
  orderNumber: string;
};

/**
 * Converts a confirmed website request into a real order — the only point where stock is
 * deducted for a website request. Reuses createOrder() (order.service.ts) for the actual
 * order/items/stock-deduction/delivery/payment/audit work, so this stays consistent with
 * every other order-creation path instead of re-implementing it.
 *
 * Idempotency: the linking UPDATE at the end is conditioned on converted_order_id still
 * being null. If a concurrent conversion already won (double-click, double-submit), that
 * UPDATE affects zero rows — this function then cancels the order it just created (restores
 * stock) and returns the already-converted message referencing the winning order instead.
 */
export async function convertWebsiteRequestToOrder(
  requestId: string,
): Promise<ServiceResult<ConvertToOrderResult>> {
  const auth = await requireStaffPermission(canManageOrders, "convert website requests to orders");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }
  const supabase = auth.supabase;

  const { data: request } = await supabase
    .from("website_order_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return serviceError("Website request was not found.");
  }

  // ── Idempotency (fast path) — avoid doing any work at all if already converted ──
  if (request.converted_order_id) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", request.converted_order_id)
      .maybeSingle();
    return serviceError(
      `This website request has already been converted to order ${existingOrder?.order_number ?? request.converted_order_id}.`,
    );
  }

  // ── Status gate ──────────────────────────────────────────────────────────────
  if (request.status === "cancelled") {
    return serviceError("Cancelled requests cannot be converted to an order.");
  }
  if (request.status !== "confirmed") {
    return serviceError("Confirm this request before converting it to an order.");
  }

  // ── Pre-conversion validation ────────────────────────────────────────────────
  if (!request.product_id || !request.product_variant_id) {
    return serviceError("This product is no longer available. Please handle this request manually.");
  }

  const { data: variant } = await supabase
    .from("product_variants")
    .select("*")
    .eq("id", request.product_variant_id)
    .maybeSingle();

  if (!variant) {
    return serviceError("This product is no longer available. Please handle this request manually.");
  }

  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    return serviceError("This request has an invalid quantity and cannot be converted.");
  }

  if (variant.stock_quantity < request.quantity) {
    return serviceError("Not enough stock to convert this request into an order.");
  }

  if (!request.customer_name?.trim() || !request.mobile_display?.trim()) {
    return serviceError("This request is missing customer details and cannot be converted.");
  }

  if (
    !request.governorate ||
    !(BAHRAIN_GOVERNORATES as readonly string[]).includes(request.governorate)
  ) {
    return serviceError("This request does not have a valid delivery address and cannot be converted.");
  }

  const unitPrice = Number(request.unit_price_snapshot);
  const totalSnapshot = Number(request.total_snapshot);
  if (!(unitPrice >= 0) || !(totalSnapshot >= 0)) {
    return serviceError("This request has invalid pricing and cannot be converted.");
  }

  // ── Customer reuse / create — race-safe, never overwrites existing data ──────
  const customerResult = await findOrCreateCustomer(
    request.customer_name,
    request.mobile_display,
    request.whatsapp_display || undefined,
  );
  if (customerResult.error || !customerResult.data) {
    return serviceError(customerResult.error ?? "Customer could not be found or created.");
  }
  const customer = customerResult.data;

  // Map the website's payment preference straight across — the value sets are identical
  // (cash_on_delivery / benefitpay / bank_transfer / payment_link).
  const paymentMethod = request.payment_preference;
  const paymentStatus =
    paymentMethod === "cash_on_delivery" ? PAYMENT_STATUSES.cod : PAYMENT_STATUSES.unpaid;

  // ── Create the real order (this is where stock is deducted) ──────────────────
  const orderResult = await createOrder({
    customerId: customer.id,
    // Round-trips the customer's own current data back through createOrder's
    // create-or-update step, so that update is a no-op — reuse without silent overwrite.
    customer: {
      fullName: customer.full_name,
      mobile: customer.mobile,
      whatsapp: customer.whatsapp ?? undefined,
      email: customer.email ?? undefined,
      // Cast is safe: a stored customer.governorate can only ever have been written through
      // this same BAHRAIN_GOVERNORATES-validated schema in the first place.
      governorate: (customer.governorate ?? undefined) as
        | (typeof BAHRAIN_GOVERNORATES)[number]
        | undefined,
      area: customer.area ?? undefined,
      block: customer.block ?? undefined,
      road: customer.road ?? undefined,
      building: customer.building ?? undefined,
      flat: customer.flat ?? undefined,
      landmark: customer.landmark ?? undefined,
      deliveryNotes: customer.delivery_notes ?? undefined,
    },
    fulfilmentMethod: FULFILMENT_METHODS.delivery,
    deliveryAddress: {
      governorate: request.governorate,
      area: request.area ?? undefined,
      block: request.block ?? undefined,
      road: request.road ?? undefined,
      building: request.building ?? undefined,
      flat: request.flat ?? undefined,
      landmark: request.landmark ?? undefined,
      deliveryNotes: request.delivery_notes ?? undefined,
    },
    orderSource: ORDER_SOURCES.websiteRequest,
    orderStatus: ORDER_STATUSES.new,
    paymentStatus,
    paymentMethod,
    deliveryDate: null,
    deliveryTimeSlot: null,
    deliveryCharge: 0,
    amountPaid: 0,
    notes: `Converted from website request ${request.request_number}.`,
    items: [
      {
        productVariantId: request.product_variant_id,
        quantity: request.quantity,
        unitPrice,
        discount: 0,
      },
    ],
  });

  if (orderResult.error || !orderResult.data) {
    return serviceError(orderResult.error ?? "Order could not be created from this request.");
  }
  const order = orderResult.data;

  // ── Atomic, idempotent link — the real double-conversion guard ───────────────
  const { data: linked } = await supabase
    .from("website_order_requests")
    .update({
      converted_order_id: order.id,
      converted_at: new Date().toISOString(),
      converted_by: auth.userId,
    })
    .eq("id", requestId)
    .is("converted_order_id", null)
    .select("id")
    .maybeSingle();

  if (!linked) {
    // Someone else converted this request between our read and our write. Roll back the
    // order we just created (restores stock) and point staff at the request that won.
    await cancelOrder(order.id);

    const { data: winningRequest } = await supabase
      .from("website_order_requests")
      .select("converted_order_id")
      .eq("id", requestId)
      .maybeSingle();
    const { data: winningOrder } = winningRequest?.converted_order_id
      ? await supabase
          .from("orders")
          .select("order_number")
          .eq("id", winningRequest.converted_order_id)
          .maybeSingle()
      : { data: null };

    return serviceError(
      `This website request has already been converted to order ${winningOrder?.order_number ?? "—"}.`,
    );
  }

  await createAuditLog({
    action: "website_request_converted_to_order",
    tableName: "website_order_requests",
    recordId: requestId,
    userId: auth.userId,
    metadata: {
      request_number: request.request_number,
      order_id: order.id,
      order_number: order.order_number,
    },
  });

  revalidatePath("/admin/website-requests");
  revalidatePath(`/admin/website-requests/${requestId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");

  return serviceSuccess({ orderId: order.id, orderNumber: order.order_number });
}
