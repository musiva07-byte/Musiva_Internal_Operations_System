import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManagePurchases } from "@/lib/auth/permissions";
import { PURCHASE_STATUSES } from "@/lib/constants";
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  ProductVariantRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  PurchasePaymentStatus,
  PurchaseStatus,
  SupplierRow,
} from "@/types/database";
import type {
  PaginatedResult,
  PurchasableVariantItem,
  PurchaseListItem,
  PurchaseWithRelations,
} from "@/types/app";

const PAGE_SIZE = 10;

type PurchaseFilters = {
  q?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
};

type PurchaseRelationRow = PurchaseOrderRow & {
  suppliers?: Pick<SupplierRow, "supplier_name"> | null;
  purchase_order_items?: Pick<PurchaseOrderItemRow, "id" | "quantity_received">[];
};

type PurchaseItemRelationRow = PurchaseOrderItemRow & {
  product_variants?: {
    variant_sku: string;
    color: string;
    size: string;
    products?: { name: string } | null;
  } | null;
};

type VariantRelationRow = ProductVariantRow & {
  products?: { name: string; sku: string } | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validatePurchaseUser() {
  return requireStaffPermission(canManagePurchases, "manage purchases");
}

export async function listPurchasableVariants(): Promise<PurchasableVariantItem[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("product_variants")
    .select("*, products(name, sku)")
    .eq("status", "active")
    .order("variant_sku", { ascending: true })
    .limit(300);

  const rows = (data ?? []) as unknown as VariantRelationRow[];

  return rows.map((row) => ({
    ...row,
    product_name: row.products?.name ?? "Product",
    product_sku: row.products?.sku ?? "",
  }));
}

export async function listPurchases(
  filters: PurchaseFilters = {},
): Promise<PaginatedResult<PurchaseListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  const search = filters.q?.trim();
  let matchingSupplierIds: string[] = [];
  if (search) {
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id")
      .or(`supplier_name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(50);
    matchingSupplierIds = (suppliers ?? []).map((supplier) => supplier.id);
  }

  let query = supabase
    .from("purchase_orders")
    .select("*, suppliers(supplier_name), purchase_order_items(id, quantity_received)", { count: "exact" })
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as PurchaseStatus);
  }

  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus as PurchasePaymentStatus);
  }

  if (search) {
    const searchFilters = [`purchase_number.ilike.%${search}%`];
    if (matchingSupplierIds.length > 0) {
      searchFilters.push(`supplier_id.in.(${matchingSupplierIds.join(",")})`);
    }
    query = query.or(searchFilters.join(","));
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as PurchaseRelationRow[];

  return {
    data: rows.map((purchase) => ({
      ...purchase,
      supplier_name: purchase.suppliers?.supplier_name ?? "Unknown supplier",
      item_count: purchase.purchase_order_items?.length ?? 0,
      received_units:
        purchase.purchase_order_items?.reduce((sum, item) => sum + Number(item.quantity_received), 0) ?? 0,
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getPurchase(purchaseId: string): Promise<PurchaseWithRelations | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: purchase } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase) {
    return null;
  }

  const [{ data: supplier }, { data: items }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", purchase.supplier_id).single(),
    supabase
      .from("purchase_order_items")
      .select("*, product_variants(variant_sku, color, size, products(name))")
      .eq("purchase_order_id", purchaseId)
      .order("created_at", { ascending: true }),
  ]);

  if (!supplier) {
    return null;
  }

  const itemRows = (items ?? []) as unknown as PurchaseItemRelationRow[];

  return {
    ...purchase,
    supplier,
    items: itemRows.map((item) => ({
      ...item,
      product_name: item.product_variants?.products?.name ?? "Product",
      variant_sku: item.product_variants?.variant_sku ?? "",
      color: item.product_variants?.color ?? "",
      size: item.product_variants?.size ?? "",
    })),
  };
}

export async function createPurchase(input: PurchaseInput): Promise<ServiceResult<PurchaseOrderRow>> {
  const parsed = purchaseSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validatePurchaseUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const purchaseInput = parsed.data;
  const subtotal = purchaseInput.items.reduce(
    (sum, item) => sum + item.quantityOrdered * item.costPrice,
    0,
  );
  const grandTotal = Math.max(0, subtotal - purchaseInput.discount + purchaseInput.shippingCost);

  const { data: purchase, error: purchaseError } = await auth.supabase
    .from("purchase_orders")
    .insert({
      supplier_id: purchaseInput.supplierId,
      purchase_date: purchaseInput.purchaseDate,
      expected_arrival_date: purchaseInput.expectedArrivalDate ?? null,
      actual_arrival_date: null,
      status: purchaseInput.status,
      payment_status: purchaseInput.paymentStatus,
      subtotal,
      discount: purchaseInput.discount,
      shipping_cost: purchaseInput.shippingCost,
      grand_total: grandTotal,
      notes: purchaseInput.notes ?? null,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (purchaseError || !purchase) {
    return serviceError("Purchase order could not be created. Please try again.");
  }

  const { error: itemError } = await auth.supabase.from("purchase_order_items").insert(
    purchaseInput.items.map((item) => ({
      purchase_order_id: purchase.id,
      product_variant_id: item.productVariantId,
      quantity_ordered: item.quantityOrdered,
      quantity_received: item.quantityReceived,
      cost_price: item.costPrice,
      line_total: item.quantityOrdered * item.costPrice,
    })),
  );

  if (itemError) {
    return serviceError("Purchase items could not be saved.");
  }

  await createAuditLog({
    action: "create_purchase",
    tableName: "purchase_orders",
    recordId: purchase.id,
    userId: auth.userId,
    metadata: {
      purchase_number: purchase.purchase_number,
      supplier_id: purchase.supplier_id,
      item_count: purchaseInput.items.length,
      grand_total: grandTotal,
    },
  });

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/suppliers");
  return serviceSuccess(purchase);
}

export async function receivePurchase(purchaseId: string): Promise<ServiceResult<PurchaseOrderRow>> {
  const auth = await validatePurchaseUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.rpc("receive_purchase_order", {
    p_purchase_order_id: purchaseId,
  });

  if (error || !data) {
    return serviceError("Purchase could not be received. Check received quantities and try again.");
  }

  await createAuditLog({
    action: "receive_purchase",
    tableName: "purchase_orders",
    recordId: purchaseId,
    userId: auth.userId,
    metadata: {
      purchase_number: data.purchase_number,
      status: PURCHASE_STATUSES.received,
    },
  });

  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${purchaseId}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  return serviceSuccess(data);
}
