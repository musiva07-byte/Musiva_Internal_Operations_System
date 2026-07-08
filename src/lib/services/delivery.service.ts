import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageDeliveries } from "@/lib/auth/permissions";
import { deliveryUpdateSchema, type DeliveryUpdateInput } from "@/lib/validations/delivery.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  DeliveryRow,
  DeliveryStatus,
  DeliveryStatusHistoryRow,
  OrderRow,
} from "@/types/database";
import type { DeliveryListItem, DeliveryTabCounts, DeliveryWithOrder, PaginatedResult } from "@/types/app";
import { getOrder } from "./order.service";

// Re-export the transition constants from shared constants (avoids server-only imports in client components)
export { DELIVERY_NEXT_STATUSES, DELIVERY_STATUSES_REQUIRING_REASON } from "@/lib/constants/statuses";

const PAGE_SIZE = 25;

type DeliveryFilters = {
  q?: string;
  status?: string;
  date?: string;
  /** One of: today | pending | packed | ready | out_for_delivery | failed | delivered | all */
  tab?: string;
  page?: number;
};

type DeliveryRelationRow = DeliveryRow & {
  orders?: Pick<
    OrderRow,
    "id" | "order_number" | "payment_status" | "amount_due" | "grand_total" | "fulfilment_method"
  > | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateDeliveryUser() {
  return requireStaffPermission(canManageDeliveries, "manage deliveries");
}

function toDeliveryPayload(input: DeliveryUpdateInput) {
  return {
    customer_name: input.customerName,
    phone: input.phone,
    governorate: input.governorate ?? null,
    area: input.area ?? null,
    block: input.block ?? null,
    road: input.road ?? null,
    building: input.building ?? null,
    flat: input.flat ?? null,
    landmark: input.landmark ?? null,
    delivery_note: input.deliveryNote ?? null,
    delivery_date: input.deliveryDate ?? null,
    delivery_time_slot: input.deliveryTimeSlot ?? null,
    courier_name: input.courierName ?? null,
    courier_phone: input.courierPhone ?? null,
    delivery_status: input.deliveryStatus,
  };
}

export async function listDeliveries(
  filters: DeliveryFilters = {},
): Promise<PaginatedResult<DeliveryListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  const search = filters.q?.trim();
  let matchingOrderIds: string[] = [];
  if (search) {
    const { data: matchingOrders } = await supabase
      .from("orders")
      .select("id")
      .ilike("order_number", `%${search}%`)
      .limit(50);
    matchingOrderIds = (matchingOrders ?? []).map((order) => order.id);
  }

  let query = supabase
    .from("deliveries")
    .select(
      "*, orders!inner(id, order_number, payment_status, amount_due, grand_total, fulfilment_method)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // ── Tab filter ──────────────────────────────────────────────────────────────
  const tab = filters.tab ?? "today";
  if (tab === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query = query.gte("created_at", todayStart.toISOString());
  } else if (tab === "pending") {
    query = query.eq("delivery_status", "pending");
  } else if (tab === "packed") {
    query = query.eq("delivery_status", "packed");
  } else if (tab === "ready") {
    query = query.in("delivery_status", ["ready_for_pickup", "with_courier"]);
  } else if (tab === "out_for_delivery") {
    query = query.eq("delivery_status", "out_for_delivery");
  } else if (tab === "failed") {
    query = query.in("delivery_status", ["failed", "returned_to_store", "returned"]);
  } else if (tab === "delivered") {
    query = query.eq("delivery_status", "delivered");
  }
  // tab === "all" → no status filter

  // ── Legacy status filter (used when explicitly on the "all" tab) ────────────
  if (filters.status && filters.status !== "all" && tab === "all") {
    query = query.eq("delivery_status", filters.status as DeliveryStatus);
  }

  if (filters.date) {
    query = query.eq("delivery_date", filters.date);
  }

  if (search) {
    const directFilters = [`phone.ilike.%${search}%`, `customer_name.ilike.%${search}%`];
    if (matchingOrderIds.length > 0) {
      directFilters.push(`order_id.in.(${matchingOrderIds.join(",")})`);
    }
    query = query.or(directFilters.join(","));
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as DeliveryRelationRow[];

  return {
    data: rows.map((delivery) => ({
      ...delivery,
      order_number: delivery.orders?.order_number ?? "",
      payment_status: delivery.orders?.payment_status ?? "unpaid",
      amount_due: Number(delivery.orders?.amount_due ?? 0),
      grand_total: Number(delivery.orders?.grand_total ?? 0),
      fulfilment_method: delivery.orders?.fulfilment_method ?? "delivery",
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function listDeliveryTabCounts(): Promise<DeliveryTabCounts> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      today: 0,
      pending: 0,
      packed: 0,
      ready: 0,
      out_for_delivery: 0,
      failed: 0,
      delivered: 0,
      all: 0,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    todayRes,
    pendingRes,
    packedRes,
    readyRes,
    outRes,
    failedRes,
    deliveredRes,
    allRes,
  ] = await Promise.all([
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "pending"),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "packed"),
    // "ready" tab covers ready_for_pickup (and with_courier as sub-state)
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .in("delivery_status", ["ready_for_pickup", "with_courier"]),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "out_for_delivery"),
    // "failed" tab covers failed + returned_to_store (both need attention)
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .in("delivery_status", ["failed", "returned_to_store", "returned"]),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "delivered"),
    supabase.from("deliveries").select("*", { count: "exact", head: true }),
  ]);

  return {
    today: todayRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    packed: packedRes.count ?? 0,
    ready: readyRes.count ?? 0,
    out_for_delivery: outRes.count ?? 0,
    failed: failedRes.count ?? 0,
    delivered: deliveredRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}

export async function getDelivery(deliveryId: string): Promise<DeliveryWithOrder | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!delivery) {
    return null;
  }

  const order = await getOrder(delivery.order_id);

  if (!order) {
    return null;
  }

  return {
    ...delivery,
    order,
  };
}

export async function updateDelivery(
  deliveryId: string,
  input: DeliveryUpdateInput,
): Promise<ServiceResult<DeliveryRow>> {
  const parsed = deliveryUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateDeliveryUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase
    .from("deliveries")
    .update(toDeliveryPayload(parsed.data))
    .eq("id", deliveryId)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Delivery could not be updated.");
  }

  await createAuditLog({
    action: "update_delivery",
    tableName: "deliveries",
    recordId: deliveryId,
    userId: auth.userId,
    metadata: {
      delivery_status: parsed.data.deliveryStatus,
      courier_name: parsed.data.courierName ?? null,
    },
  });

  revalidatePath("/admin/deliveries");
  revalidatePath(`/admin/deliveries/${deliveryId}`);
  revalidatePath(`/admin/orders/${data.order_id}`);
  return serviceSuccess(data);
}

/**
 * Advance a delivery through a controlled state machine transition.
 * Validation is enforced by the Postgres RPC — any invalid transition raises an exception.
 */
export async function advanceDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus,
  reason?: string,
  note?: string,
  collectedAmount?: number,
): Promise<ServiceResult<DeliveryRow>> {
  const auth = await validateDeliveryUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.rpc("advance_delivery_status", {
    p_delivery_id: deliveryId,
    p_new_status: newStatus,
    p_reason: reason ?? null,
    p_note: note ?? null,
    p_collected_amt: collectedAmount ?? null,
  });

  if (error || !data) {
    // Surface the PG exception message directly — it's already user-friendly
    return serviceError(error?.message ?? "Delivery status could not be updated.");
  }

  await createAuditLog({
    action: "advance_delivery_status",
    tableName: "deliveries",
    recordId: deliveryId,
    userId: auth.userId,
    metadata: { new_status: newStatus, reason: reason ?? null },
  });

  revalidatePath("/admin/deliveries");
  revalidatePath(`/admin/deliveries/${deliveryId}`);
  revalidatePath(`/admin/orders/${(data as DeliveryRow).order_id}`);
  return serviceSuccess(data as DeliveryRow);
}

/**
 * Apply the same delivery status transition to multiple deliveries in parallel.
 * Only safe bulk actions (packed / ready_for_pickup) are accepted.
 */
export async function bulkDeliveryAction(
  deliveryIds: string[],
  newStatus: "packed" | "ready_for_pickup",
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const results = await Promise.allSettled(
    deliveryIds.map((id) => advanceDeliveryStatus(id, newStatus)),
  );

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && !result.value.error) {
      successCount++;
    } else {
      failCount++;
      if (result.status === "fulfilled" && result.value.error) {
        errors.push(result.value.error);
      }
    }
  }

  if (successCount > 0) {
    revalidatePath("/admin/deliveries");
  }

  return { successCount, failCount, errors };
}

export async function getDeliveryHistory(deliveryId: string): Promise<DeliveryStatusHistoryRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("delivery_status_history")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });

  return data ?? [];
}
