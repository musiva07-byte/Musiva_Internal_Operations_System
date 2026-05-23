import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageDeliveries } from "@/lib/auth/permissions";
import { deliveryUpdateSchema, type DeliveryUpdateInput } from "@/lib/validations/delivery.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { DeliveryRow, DeliveryStatus, OrderRow } from "@/types/database";
import type { DeliveryListItem, DeliveryWithOrder, PaginatedResult } from "@/types/app";
import { getOrder } from "./order.service";

const PAGE_SIZE = 12;

type DeliveryFilters = {
  q?: string;
  status?: string;
  date?: string;
  page?: number;
};

type DeliveryRelationRow = DeliveryRow & {
  orders?: Pick<OrderRow, "id" | "order_number" | "payment_status" | "amount_due" | "grand_total"> | null;
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
    .select("*, orders!inner(id, order_number, payment_status, amount_due, grand_total)", { count: "exact" })
    .order("delivery_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
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
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getDelivery(deliveryId: string): Promise<DeliveryWithOrder | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).maybeSingle();

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
