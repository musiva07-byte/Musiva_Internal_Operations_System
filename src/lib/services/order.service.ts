import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import {
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from "@/lib/validations/order.schema";
import { normalizeBahrainPhone } from "@/lib/utils/phone";
import { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_NEXT_STATUSES } from "@/lib/constants";
import { canManageOrders } from "@/lib/auth/permissions";
import { titleize } from "@/lib/formatters/labels";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  CustomerRow,
  DeliveryStatus,
  OrderRow,
  OrderStatus,
  PaymentStatus,
  ProductVariantRow,
} from "@/types/database";
import type {
  OrderableVariantItem,
  OrderListItem,
  OrderTabCounts,
  OrderWithRelations,
  PaginatedResult,
} from "@/types/app";

const PAGE_SIZE = 25;

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderFilters = {
  q?: string;
  orderStatus?: string;
  paymentStatus?: string;
  fulfilmentMethod?: string;
  /** One of: today | new | confirmed | in_fulfilment | completed | cancelled | all */
  tab?: string;
  page?: number;
};

type OrderRelationRow = OrderRow & {
  customers?: Pick<CustomerRow, "full_name" | "mobile"> | null;
  order_items?: { id: string }[];
  deliveries?: { id: string; delivery_status: DeliveryStatus }[];
};

type VariantRelationRow = ProductVariantRow & {
  products?: { name: string; sku: string } | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateAuthenticatedOrderUser() {
  return requireStaffPermission(canManageOrders, "manage orders");
}

function customerPayload(input: CreateOrderInput["customer"]) {
  return {
    full_name: input.fullName,
    mobile: input.mobile,
    mobile_normalized: normalizeBahrainPhone(input.mobile),
    whatsapp: input.whatsapp ?? null,
    whatsapp_normalized: input.whatsapp ? normalizeBahrainPhone(input.whatsapp) : null,
    email: input.email ?? null,
    governorate: input.governorate ?? null,
    area: input.area ?? null,
    block: input.block ?? null,
    road: input.road ?? null,
    building: input.building ?? null,
    flat: input.flat ?? null,
    landmark: input.landmark ?? null,
    delivery_notes: input.deliveryNotes ?? null,
  };
}

// ─── List and fetch ───────────────────────────────────────────────────────────

export async function listOrderableVariants(): Promise<OrderableVariantItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_variants")
    .select("*, products!inner(name, sku)")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as VariantRelationRow[];
  return rows.map((row) => ({
    ...row,
    product_name: row.products?.name ?? "Unknown product",
    product_sku: row.products?.sku ?? "",
  }));
}

export async function listOrders(
  filters: OrderFilters = {},
): Promise<PaginatedResult<OrderListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("orders")
    .select(
      "*, customers(full_name, mobile), order_items(id), deliveries(id, delivery_status)",
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
  } else if (tab === "new") {
    query = query.eq("order_status", "new");
  } else if (tab === "confirmed") {
    query = query.eq("order_status", "confirmed");
  } else if (tab === "in_fulfilment") {
    // Include legacy statuses that map to in_fulfilment
    query = query.in("order_status", [
      "in_fulfilment",
      "packed",
      "ready_for_pickup",
      "out_for_delivery",
    ]);
  } else if (tab === "completed") {
    // Include legacy "delivered" and "returned" mapped to completed/returned
    query = query.in("order_status", ["completed", "delivered", "returned"]);
  } else if (tab === "cancelled") {
    query = query.eq("order_status", "cancelled");
  }
  // tab === "all" → no status filter

  // ── Text search ─────────────────────────────────────────────────────────────
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    const { data: matchingCustomers } = await supabase
      .from("customers")
      .select("id")
      .or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%,mobile_normalized.ilike.%${q}%`)
      .limit(50);

    const customerIds = (matchingCustomers ?? []).map((c) => c.id);
    const orParts = [`order_number.ilike.%${q}%`];
    if (customerIds.length > 0) {
      orParts.push(`customer_id.in.(${customerIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  // ── Explicit filters (only on "all" tab) ────────────────────────────────────
  if (filters.orderStatus && filters.orderStatus !== "all" && tab === "all") {
    query = query.eq("order_status", filters.orderStatus as OrderStatus);
  }
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus as PaymentStatus);
  }
  if (filters.fulfilmentMethod && filters.fulfilmentMethod !== "all") {
    query = query.eq(
      "fulfilment_method",
      filters.fulfilmentMethod as import("@/types/database").FulfilmentMethod,
    );
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as OrderRelationRow[];

  return {
    data: rows.map((order) => ({
      ...order,
      customer_name: order.customers?.full_name ?? "Unknown customer",
      customer_mobile: order.customers?.mobile ?? "",
      item_count: order.order_items?.length ?? 0,
      delivery_id: Array.isArray(order.deliveries)
        ? (order.deliveries[0]?.id ?? null)
        : null,
      delivery_status: Array.isArray(order.deliveries)
        ? (order.deliveries[0]?.delivery_status ?? null)
        : null,
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function listOrdersTabCounts(): Promise<OrderTabCounts> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { today: 0, new: 0, confirmed: 0, in_fulfilment: 0, completed: 0, cancelled: 0, all: 0 };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayRes, newRes, confirmedRes, inFulfilmentRes, completedRes, cancelledRes, allRes] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("order_status", "new"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("order_status", "confirmed"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("order_status", ["in_fulfilment", "packed", "ready_for_pickup", "out_for_delivery"]),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("order_status", ["completed", "delivered", "returned"]),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("order_status", "cancelled"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
    ]);

  return {
    today: todayRes.count ?? 0,
    new: newRes.count ?? 0,
    confirmed: confirmedRes.count ?? 0,
    in_fulfilment: inFulfilmentRes.count ?? 0,
    completed: completedRes.count ?? 0,
    cancelled: cancelledRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}

export async function getOrder(orderId: string): Promise<OrderWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const [{ data: customer }, { data: items }, { data: payments }, { data: delivery }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", order.customer_id).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      supabase.from("payments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("deliveries").select("*").eq("order_id", orderId).maybeSingle(),
    ]);

  if (!customer) return null;

  return { ...order, customer, items: items ?? [], payments: payments ?? [], delivery: delivery ?? null };
}

// ─── Confirmation handoff ─────────────────────────────────────────────────────

/**
 * Confirm a delivery order: validates, creates the delivery record (idempotent),
 * and moves the order to in_fulfilment in one atomic step.
 *
 * For walk-in / pickup orders, use transitionOrderStatus(id, "confirmed") instead.
 */
export async function confirmOrderHandoff(
  orderId: string,
): Promise<ServiceResult<OrderRow>> {
  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: existing } = await auth.supabase
    .from("orders")
    .select("*, customers(*), deliveries(id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!existing) return serviceError("Order was not found.");

  const order = existing as unknown as OrderRow & {
    customers?: CustomerRow | null;
    deliveries?: { id: string }[];
  };

  if (order.fulfilment_method !== "delivery") {
    return serviceError(
      "Only delivery orders use the confirmation handoff. Walk-in orders use standard confirmation.",
    );
  }

  if (!["new", "confirmed"].includes(order.order_status)) {
    return serviceError(
      `Order is already "${titleize(order.order_status)}" and cannot be sent to fulfilment.`,
    );
  }

  // Idempotent delivery creation — do not create duplicates
  const hasDelivery = Array.isArray(order.deliveries) && order.deliveries.length > 0;

  if (!hasDelivery) {
    const { data: customer } = await auth.supabase
      .from("customers")
      .select("*")
      .eq("id", order.customer_id)
      .single();

    if (!customer) return serviceError("Customer record was not found.");

    const { error: deliveryError } = await auth.supabase.from("deliveries").insert({
      order_id: order.id,
      customer_name: customer.full_name,
      phone: customer.mobile,
      governorate: customer.governorate ?? null,
      area: customer.area ?? null,
      block: customer.block ?? null,
      road: customer.road ?? null,
      building: customer.building ?? null,
      flat: customer.flat ?? null,
      landmark: customer.landmark ?? null,
      delivery_note: customer.delivery_notes ?? null,
      delivery_date: null,
      delivery_time_slot: null,
      courier_name: null,
      courier_phone: null,
      delivery_status: "pending" as DeliveryStatus,
      assigned_to_id: null,
      assigned_at: null,
      failure_reason: null,
      failure_note: null,
      cod_amount: order.payment_status === "cod" ? order.grand_total : null,
      cod_collected: false,
      cod_collected_at: null,
    });

    if (deliveryError) {
      return serviceError("Delivery record could not be created.");
    }
  }

  const { data, error } = await auth.supabase
    .from("orders")
    .update({ order_status: "in_fulfilment" as OrderStatus })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) return serviceError("Order could not be moved to fulfilment.");

  await createAuditLog({
    action: "confirm_order_handoff",
    tableName: "orders",
    recordId: orderId,
    userId: auth.userId,
    metadata: {
      previous_status: order.order_status,
      order_status: "in_fulfilment",
      delivery_created: !hasDelivery,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/deliveries");
  return serviceSuccess(data);
}

// ─── Status transitions ───────────────────────────────────────────────────────

/**
 * Transition a walk-in / pickup order through the simplified state machine.
 * For delivery orders, use confirmOrderHandoff() instead.
 *
 * Allowed paths:
 *   new → confirmed    (walk-in confirm)
 *   confirmed → completed  (walk-in completion)
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
): Promise<ServiceResult<OrderRow>> {
  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: existing } = await auth.supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!existing) return serviceError("Order was not found.");

  const allowedNext = ORDER_NEXT_STATUSES[existing.order_status] ?? [];
  if (!allowedNext.includes(newStatus)) {
    return serviceError(
      `Cannot move order from "${titleize(existing.order_status)}" to "${titleize(newStatus)}".`,
    );
  }

  // Delivery orders must use confirmOrderHandoff — not this function
  if (
    existing.fulfilment_method === "delivery" &&
    newStatus === "in_fulfilment"
  ) {
    return serviceError(
      "Use the confirmation handoff for delivery orders.",
    );
  }

  const { data, error } = await auth.supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) return serviceError("Order status could not be updated.");

  await createAuditLog({
    action: "update_order",
    tableName: "orders",
    recordId: orderId,
    userId: auth.userId,
    metadata: {
      previous_status: existing.order_status,
      order_status: newStatus,
      reason: reason ?? null,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return serviceSuccess(data);
}

// ─── Bulk action ──────────────────────────────────────────────────────────────

/**
 * Apply "confirm" to multiple orders at once.
 * For delivery orders this triggers confirmOrderHandoff.
 * For walk-in orders this runs transitionOrderStatus → confirmed.
 */
export async function bulkOrderAction(
  orderIds: string[],
  action: "confirm",
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  if (action !== "confirm") {
    return { successCount: 0, failCount: orderIds.length, errors: ["Invalid bulk action."] };
  }

  // Fetch the fulfilment_method for each order to route correctly
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { successCount: 0, failCount: orderIds.length, errors: ["Not available."] };
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, fulfilment_method, order_status")
    .in("id", orderIds);

  const rows = orders ?? [];

  const results = await Promise.allSettled(
    rows.map((o) => {
      if (o.fulfilment_method === "delivery") {
        return confirmOrderHandoff(o.id);
      }
      return transitionOrderStatus(o.id, "confirmed" as OrderStatus);
    }),
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

  if (successCount > 0) revalidatePath("/admin/orders");
  return { successCount, failCount, errors };
}

// ─── Create order ─────────────────────────────────────────────────────────────

async function createOrUpdateCustomer(
  input: CreateOrderInput,
  userId: string,
): Promise<ServiceResult<CustomerRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return serviceError("Supabase is not configured.");

  const payload = customerPayload(input.customer);

  if (input.customerId) {
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", input.customerId)
      .select()
      .single();
    if (error || !data) return serviceError("Customer could not be updated.");
    return serviceSuccess(data);
  }

  const normalizedMobile = normalizeBahrainPhone(input.customer.mobile);
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq(
      normalizedMobile ? "mobile_normalized" : "mobile",
      normalizedMobile ?? input.customer.mobile,
    )
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !data) return serviceError("Customer could not be updated.");
    return serviceSuccess(data);
  }

  const { data, error } = await supabase.from("customers").insert(payload).select().single();
  if (error || !data) return serviceError("Customer could not be created.");

  await createAuditLog({
    action: "create_customer",
    tableName: "customers",
    recordId: data.id,
    userId,
    metadata: { mobile: data.mobile },
  });

  return serviceSuccess(data);
}

export async function createOrder(input: CreateOrderInput): Promise<ServiceResult<OrderRow>> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return serviceError(parsed.error.issues[0]?.message);

  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supabase = auth.supabase;
  const orderInput = parsed.data;
  const variantIds = [...new Set(orderInput.items.map((item) => item.productVariantId))];

  const { data: variantRows } = await supabase
    .from("product_variants")
    .select("*, products!inner(name, sku)")
    .in("id", variantIds);

  const variants = (variantRows ?? []) as unknown as VariantRelationRow[];

  if (variants.length !== variantIds.length) {
    return serviceError("Please select valid products.");
  }

  for (const item of orderInput.items) {
    const variant = variants.find((row) => row.id === item.productVariantId);
    if (!variant || variant.stock_quantity < item.quantity) {
      return serviceError("Not enough stock available.");
    }
  }

  const customerResult = await createOrUpdateCustomer(orderInput, auth.userId);
  if (customerResult.error || !customerResult.data) {
    return serviceError(customerResult.error ?? "Customer could not be saved.");
  }

  const subtotal = orderInput.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discountTotal = orderInput.items.reduce((sum, item) => sum + item.discount, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + orderInput.deliveryCharge);
  const amountDue = Math.max(0, grandTotal - orderInput.amountPaid);

  // Determine initial order status:
  // Delivery orders start as "new" and move to in_fulfilment via confirmOrderHandoff.
  // Walk-in orders may also start as "new" or "confirmed" if staff confirms immediately.
  const initialStatus: OrderStatus =
    orderInput.orderStatus === "confirmed" && orderInput.fulfilmentMethod !== "delivery"
      ? "confirmed"
      : "new";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerResult.data.id,
      order_source: orderInput.orderSource,
      order_status: initialStatus,
      payment_status: orderInput.paymentStatus,
      payment_method: orderInput.paymentMethod ?? null,
      fulfilment_method: orderInput.fulfilmentMethod ?? "walk_in",
      subtotal,
      discount_total: discountTotal,
      delivery_charge: orderInput.deliveryCharge,
      grand_total: grandTotal,
      amount_paid: orderInput.amountPaid,
      amount_due: amountDue,
      staff_id: auth.userId,
      notes: orderInput.notes ?? null,
    })
    .select()
    .single();

  if (orderError || !order) {
    return serviceError("Order could not be created. Please try again.");
  }

  const itemRows = orderInput.items.map((item) => {
    const variant = variants.find((row) => row.id === item.productVariantId);
    const lineTotal = Math.max(0, item.unitPrice * item.quantity - item.discount);
    return {
      order_id: order.id,
      product_variant_id: item.productVariantId,
      product_name_snapshot: variant?.products?.name ?? "Product",
      variant_sku_snapshot: variant?.variant_sku ?? "",
      size_snapshot: variant?.size ?? "",
      color_snapshot: variant?.color ?? "",
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount,
      line_total: lineTotal,
    };
  });

  const { error: itemError } = await supabase.from("order_items").insert(itemRows);
  if (itemError) {
    return serviceError("Order items could not be saved. Please review this order before retrying.");
  }

  for (const item of orderInput.items) {
    const { error: stockError } = await supabase.rpc("deduct_variant_stock", {
      p_variant_id: item.productVariantId,
      p_quantity: item.quantity,
      p_reference_type: "order",
      p_reference_id: order.id,
      p_note: `Stock deducted for ${order.order_number}.`,
    });

    if (stockError) {
      await supabase
        .from("orders")
        .update({
          order_status: ORDER_STATUSES.cancelled,
          notes: "Stock deduction failed after order creation. Review before fulfilment.",
        })
        .eq("id", order.id);
      return serviceError("Not enough stock available.");
    }
  }

  // For delivery orders: create the delivery record immediately
  if (orderInput.fulfilmentMethod === "delivery") {
    const addr = orderInput.deliveryAddress;
    const customer = customerResult.data;
    const { error: deliveryError } = await supabase.from("deliveries").insert({
      order_id: order.id,
      customer_name: customer.full_name,
      phone: customer.mobile,
      governorate: addr?.governorate ?? customer.governorate ?? null,
      area: addr?.area ?? customer.area ?? null,
      block: addr?.block ?? customer.block ?? null,
      road: addr?.road ?? customer.road ?? null,
      building: addr?.building ?? customer.building ?? null,
      flat: addr?.flat ?? customer.flat ?? null,
      landmark: addr?.landmark ?? customer.landmark ?? null,
      delivery_note: addr?.deliveryNotes ?? customer.delivery_notes ?? null,
      delivery_date: orderInput.deliveryDate ?? null,
      delivery_time_slot: orderInput.deliveryTimeSlot ?? null,
      courier_name: null,
      courier_phone: null,
      delivery_status: "pending" as DeliveryStatus,
      assigned_to_id: null,
      assigned_at: null,
      failure_reason: null,
      failure_note: null,
      cod_amount: orderInput.paymentStatus === "cod" ? grandTotal : null,
      cod_collected: false,
      cod_collected_at: null,
    });

    if (deliveryError) {
      return serviceError("Order was created, but the delivery record could not be created.");
    }
  }

  if (
    orderInput.paymentMethod &&
    (orderInput.amountPaid > 0 || orderInput.paymentStatus !== PAYMENT_STATUSES.unpaid)
  ) {
    await supabase.from("payments").insert({
      order_id: order.id,
      payment_method: orderInput.paymentMethod,
      payment_status: orderInput.paymentStatus,
      amount: orderInput.amountPaid,
      reference_number: orderInput.paymentReference ?? null,
      note: orderInput.paymentNote ?? null,
      created_by: auth.userId,
    });
  }

  await createAuditLog({
    action: "create_order",
    tableName: "orders",
    recordId: order.id,
    userId: auth.userId,
    metadata: {
      order_number: order.order_number,
      customer_id: customerResult.data.id,
      grand_total: grandTotal,
      items: orderInput.items.length,
      fulfilment_method: orderInput.fulfilmentMethod,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  return serviceSuccess(order);
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: string): Promise<ServiceResult<OrderRow>> {
  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: existing } = await auth.supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!existing) return serviceError("Order was not found.");

  if (["cancelled", "completed", "delivered", "returned"].includes(existing.order_status)) {
    return serviceError(
      `This order is already ${existing.order_status} and cannot be cancelled.`,
    );
  }

  const { data, error } = await auth.supabase
    .from("orders")
    .update({ order_status: ORDER_STATUSES.cancelled })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) return serviceError("Order could not be cancelled.");

  const { data: items } = await auth.supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (items) {
    for (const item of items) {
      await auth.supabase.rpc("add_variant_stock", {
        p_variant_id: item.product_variant_id,
        p_quantity: item.quantity,
        p_movement_type: "cancelled_order_restore",
        p_reference_type: "order",
        p_reference_id: orderId,
        p_note: `Stock restored: order ${existing.order_number} cancelled.`,
      });
    }
  }

  await createAuditLog({
    action: "cancel_order",
    tableName: "orders",
    recordId: orderId,
    userId: auth.userId,
    metadata: { order_number: existing.order_number },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
  return serviceSuccess(data);
}

// ─── Update (payment / notes) ─────────────────────────────────────────────────

export async function updateOrder(
  orderId: string,
  input: UpdateOrderInput,
): Promise<ServiceResult<OrderRow>> {
  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) return serviceError(parsed.error.issues[0]?.message);

  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: existing } = await auth.supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!existing) return serviceError("Order was not found.");

  const amountDue = Math.max(0, Number(existing.grand_total) - parsed.data.amountPaid);
  const { data, error } = await auth.supabase
    .from("orders")
    .update({
      order_status: parsed.data.orderStatus,
      payment_status: parsed.data.paymentStatus,
      payment_method: parsed.data.paymentMethod ?? null,
      amount_paid: parsed.data.amountPaid,
      amount_due: amountDue,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) return serviceError("Order could not be updated.");

  await createAuditLog({
    action: "update_order",
    tableName: "orders",
    recordId: orderId,
    userId: auth.userId,
    metadata: {
      order_status: parsed.data.orderStatus,
      payment_status: parsed.data.paymentStatus,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return serviceSuccess(data);
}
