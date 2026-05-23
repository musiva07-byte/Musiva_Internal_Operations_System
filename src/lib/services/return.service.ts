import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canProcessReturns } from "@/lib/auth/permissions";
import {
  RETURN_ITEM_ACTIONS,
  RETURN_STATUSES,
  STOCK_MOVEMENT_TYPES,
} from "@/lib/constants";
import { returnSchema, type ReturnInput } from "@/lib/validations/return.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  CustomerRow,
  OrderItemRow,
  OrderRow,
  ProductVariantRow,
  ReturnRow,
  ReturnStatus,
} from "@/types/database";
import type { PaginatedResult, ReturnListItem, ReturnWithRelations } from "@/types/app";

const PAGE_SIZE = 10;

type ReturnFilters = {
  q?: string;
  status?: string;
  page?: number;
};

type ReturnRelationRow = ReturnRow & {
  orders?: Pick<OrderRow, "order_number"> | null;
  customers?: Pick<CustomerRow, "full_name" | "mobile"> | null;
  return_items?: { id: string }[];
};

type ReturnItemRelationRow = {
  id: string;
  return_id: string;
  product_variant_id: string;
  quantity: number;
  action: string;
  created_at: string;
  product_variants?: {
    variant_sku: string;
    size: string;
    color: string;
    products?: { name: string } | null;
  } | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateReturnUser() {
  return requireStaffPermission(canProcessReturns, "process returns");
}

export async function listReturnOrders() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("orders")
    .select("*, customers(full_name, mobile)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []) as unknown as Array<OrderRow & { customers?: Pick<CustomerRow, "full_name" | "mobile"> | null }>;
}

export async function listRecentReturnableItems(): Promise<OrderItemRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(100);
  const orderIds = (orders ?? []).map((order) => order.id);

  if (orderIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function listReturnableOrderItems(orderId?: string): Promise<OrderItemRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase || !orderId) {
    return [];
  }

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function listReturns(filters: ReturnFilters = {}): Promise<PaginatedResult<ReturnListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  const search = filters.q?.trim();
  let matchingOrderIds: string[] = [];
  let matchingCustomerIds: string[] = [];
  if (search) {
    const [{ data: orders }, { data: customers }] = await Promise.all([
      supabase.from("orders").select("id").ilike("order_number", `%${search}%`).limit(50),
      supabase
        .from("customers")
        .select("id")
        .or(`full_name.ilike.%${search}%,mobile.ilike.%${search}%`)
        .limit(50),
    ]);
    matchingOrderIds = (orders ?? []).map((order) => order.id);
    matchingCustomerIds = (customers ?? []).map((customer) => customer.id);
  }

  let query = supabase
    .from("returns")
    .select("*, orders(order_number), customers(full_name, mobile), return_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as ReturnStatus);
  }

  if (search) {
    const searchFilters: string[] = [];
    if (matchingOrderIds.length > 0) {
      searchFilters.push(`original_order_id.in.(${matchingOrderIds.join(",")})`);
    }
    if (matchingCustomerIds.length > 0) {
      searchFilters.push(`customer_id.in.(${matchingCustomerIds.join(",")})`);
    }
    if (searchFilters.length === 0) {
      return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
    }
    query = query.or(searchFilters.join(","));
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as ReturnRelationRow[];

  return {
    data: rows.map((row) => ({
      ...row,
      order_number: row.orders?.order_number ?? "",
      customer_name: row.customers?.full_name ?? "Unknown customer",
      customer_mobile: row.customers?.mobile ?? "",
      item_count: row.return_items?.length ?? 0,
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getReturn(returnId: string): Promise<ReturnWithRelations | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: returnRecord } = await supabase.from("returns").select("*").eq("id", returnId).maybeSingle();

  if (!returnRecord) {
    return null;
  }

  const [{ data: order }, { data: customer }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", returnRecord.original_order_id).single(),
    supabase.from("customers").select("*").eq("id", returnRecord.customer_id).single(),
    supabase
      .from("return_items")
      .select("*, product_variants(variant_sku, size, color, products(name))")
      .eq("return_id", returnId)
      .order("created_at", { ascending: true }),
  ]);

  if (!order || !customer) {
    return null;
  }

  const itemRows = (items ?? []) as unknown as ReturnItemRelationRow[];

  return {
    ...returnRecord,
    order,
    customer,
    items: itemRows.map((item) => ({
      id: item.id,
      return_id: item.return_id,
      product_variant_id: item.product_variant_id,
      quantity: item.quantity,
      action: item.action as ReturnWithRelations["items"][number]["action"],
      created_at: item.created_at,
      product_name_snapshot: item.product_variants?.products?.name ?? "Product",
      variant_sku_snapshot: item.product_variants?.variant_sku ?? "",
      size_snapshot: item.product_variants?.size ?? "",
      color_snapshot: item.product_variants?.color ?? "",
    })),
  };
}

export async function createReturn(input: ReturnInput): Promise<ServiceResult<ReturnRow>> {
  const parsed = returnSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateReturnUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supabase = auth.supabase;
  const returnInput = parsed.data;
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", returnInput.originalOrderId)
    .maybeSingle();

  if (!order) {
    return serviceError("Original order was not found.");
  }

  const variantIds = [...new Set(returnInput.items.map((item) => item.productVariantId))];
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .in("product_variant_id", variantIds);

  if ((orderItems ?? []).length !== variantIds.length) {
    return serviceError("One or more selected items do not belong to the original order.");
  }

  for (const item of returnInput.items) {
    const soldItem = (orderItems ?? []).find((row) => row.product_variant_id === item.productVariantId);
    if (!soldItem || item.quantity > soldItem.quantity) {
      return serviceError("Return quantity cannot exceed the original sold quantity.");
    }
  }

  const { data: returnRecord, error: returnError } = await supabase
    .from("returns")
    .insert({
      original_order_id: order.id,
      customer_id: order.customer_id,
      return_type: returnInput.returnType,
      reason: returnInput.reason,
      condition: returnInput.condition,
      refund_amount: returnInput.refundAmount,
      exchange_order_id: returnInput.exchangeOrderId ?? null,
      status: returnInput.status,
      staff_id: auth.userId,
      notes: returnInput.notes ?? null,
    })
    .select()
    .single();

  if (returnError || !returnRecord) {
    return serviceError("Return could not be created. Please try again.");
  }

  const { error: itemError } = await supabase.from("return_items").insert(
    returnInput.items.map((item) => ({
      return_id: returnRecord.id,
      product_variant_id: item.productVariantId,
      quantity: item.quantity,
      action: item.action,
    })),
  );

  if (itemError) {
    return serviceError("Return items could not be saved.");
  }

  if (returnInput.status === RETURN_STATUSES.completed) {
    for (const item of returnInput.items) {
      if (item.action === RETURN_ITEM_ACTIONS.addBackToStock || item.action === RETURN_ITEM_ACTIONS.exchange) {
        const { error } = await supabase.rpc("add_variant_stock", {
          p_variant_id: item.productVariantId,
          p_quantity: item.quantity,
          p_movement_type: STOCK_MOVEMENT_TYPES.returnAdded,
          p_reference_type: "return",
          p_reference_id: returnRecord.id,
          p_note: `Returned sellable stock from ${order.order_number}.`,
        });
        if (error) {
          return serviceError("Return was created, but stock restoration failed.");
        }
      }

      if (item.action === RETURN_ITEM_ACTIONS.markDamaged) {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("*")
          .eq("id", item.productVariantId)
          .single();
        const currentStock = Number((variant as ProductVariantRow | null)?.stock_quantity ?? 0);
        const { error } = await supabase.from("stock_movements").insert({
          product_variant_id: item.productVariantId,
          movement_type: STOCK_MOVEMENT_TYPES.damaged,
          quantity: item.quantity,
          previous_quantity: currentStock,
          new_quantity: currentStock,
          reference_type: "return",
          reference_id: returnRecord.id,
          note: `Returned item marked damaged from ${order.order_number}. Sellable stock unchanged.`,
          created_by: auth.userId,
        });
        if (error) {
          return serviceError("Return was created, but damaged stock movement failed.");
        }
      }
    }
  }

  await createAuditLog({
    action: "process_return",
    tableName: "returns",
    recordId: returnRecord.id,
    userId: auth.userId,
    metadata: {
      order_number: order.order_number,
      return_type: returnInput.returnType,
      status: returnInput.status,
      items: returnInput.items.length,
      refund_amount: returnInput.refundAmount,
    },
  });

  revalidatePath("/admin/returns");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  revalidatePath(`/admin/orders/${order.id}`);
  return serviceSuccess(returnRecord);
}
