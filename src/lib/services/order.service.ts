import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import {
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from "@/lib/validations/order.schema";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { canManageOrders } from "@/lib/auth/permissions";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  CustomerRow,
  OrderRow,
  OrderStatus,
  PaymentStatus,
  ProductVariantRow,
} from "@/types/database";
import type { OrderableVariantItem, OrderListItem, OrderWithRelations, PaginatedResult } from "@/types/app";

const PAGE_SIZE = 10;

type OrderFilters = {
  q?: string;
  orderStatus?: string;
  paymentStatus?: string;
  page?: number;
};

type OrderRelationRow = OrderRow & {
  customers?: Pick<CustomerRow, "full_name" | "mobile"> | null;
  order_items?: { id: string }[];
};

type VariantRelationRow = ProductVariantRow & {
  products?: {
    name: string;
    sku: string;
  } | null;
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
    whatsapp: input.whatsapp ?? null,
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

export async function listOrderableVariants(): Promise<OrderableVariantItem[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

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

export async function listOrders(filters: OrderFilters = {}): Promise<PaginatedResult<OrderListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("orders")
    .select("*, customers(full_name, mobile), order_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.q?.trim()) {
    query = query.ilike("order_number", `%${filters.q.trim()}%`);
  }

  if (filters.orderStatus && filters.orderStatus !== "all") {
    query = query.eq("order_status", filters.orderStatus as OrderStatus);
  }

  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus as PaymentStatus);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as OrderRelationRow[];

  return {
    data: rows.map((order) => ({
      ...order,
      customer_name: order.customers?.full_name ?? "Unknown customer",
      customer_mobile: order.customers?.mobile ?? "",
      item_count: order.order_items?.length ?? 0,
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getOrder(orderId: string): Promise<OrderWithRelations | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

  if (!order) {
    return null;
  }

  const [{ data: customer }, { data: items }, { data: payments }, { data: delivery }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", order.customer_id).single(),
    supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    supabase.from("payments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    supabase.from("deliveries").select("*").eq("order_id", orderId).maybeSingle(),
  ]);

  if (!customer) {
    return null;
  }

  return {
    ...order,
    customer,
    items: items ?? [],
    payments: payments ?? [],
    delivery: delivery ?? null,
  };
}

async function createOrUpdateCustomer(input: CreateOrderInput, userId: string): Promise<ServiceResult<CustomerRow>> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return serviceError("Supabase is not configured.");
  }

  const payload = customerPayload(input.customer);

  if (input.customerId) {
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", input.customerId)
      .select()
      .single();

    if (error || !data) {
      return serviceError("Customer could not be updated.");
    }

    return serviceSuccess(data);
  }

  const { data: existing } = await supabase.from("customers").select("*").eq("mobile", input.customer.mobile).maybeSingle();

  if (existing) {
    const { data, error } = await supabase.from("customers").update(payload).eq("id", existing.id).select().single();

    if (error || !data) {
      return serviceError("Customer could not be updated.");
    }

    return serviceSuccess(data);
  }

  const { data, error } = await supabase.from("customers").insert(payload).select().single();

  if (error || !data) {
    return serviceError("Customer could not be created.");
  }

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

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

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

  const subtotal = orderInput.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = orderInput.items.reduce((sum, item) => sum + item.discount, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + orderInput.deliveryCharge);
  const amountDue = Math.max(0, grandTotal - orderInput.amountPaid);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerResult.data.id,
      order_source: orderInput.orderSource,
      order_status: orderInput.orderStatus,
      payment_status: orderInput.paymentStatus,
      payment_method: orderInput.paymentMethod ?? null,
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

  if (orderInput.deliveryRequired) {
    const { error: deliveryError } = await supabase.from("deliveries").insert({
      order_id: order.id,
      customer_name: customerResult.data.full_name,
      phone: customerResult.data.mobile,
      governorate: customerResult.data.governorate,
      area: customerResult.data.area,
      block: customerResult.data.block,
      road: customerResult.data.road,
      building: customerResult.data.building,
      flat: customerResult.data.flat,
      landmark: customerResult.data.landmark,
      delivery_note: customerResult.data.delivery_notes,
      delivery_date: orderInput.deliveryDate ?? null,
      delivery_time_slot: orderInput.deliveryTimeSlot ?? null,
      courier_name: null,
      courier_phone: null,
      delivery_status: "pending",
    });

    if (deliveryError) {
      return serviceError("Order was created, but the delivery record could not be created.");
    }
  }

  if (orderInput.paymentMethod && (orderInput.amountPaid > 0 || orderInput.paymentStatus !== PAYMENT_STATUSES.unpaid)) {
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
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  return serviceSuccess(order);
}

export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<ServiceResult<OrderRow>> {
  const parsed = updateOrderSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateAuthenticatedOrderUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data: existing } = await auth.supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!existing) {
    return serviceError("Order was not found.");
  }

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

  if (error || !data) {
    return serviceError("Order could not be updated.");
  }

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
