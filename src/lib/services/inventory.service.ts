import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canAdjustInventory } from "@/lib/auth/permissions";
import {
  stockAdjustmentSchema,
  stockEntrySchema,
  type StockAdjustmentInput,
  type StockEntryInput,
} from "@/lib/validations/inventory.schema";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { InventoryVariantItem, PaginatedResult, StockMovementItem } from "@/types/app";
import type { ProductVariantRow, StockMovementRow, StockMovementType } from "@/types/database";

const PAGE_SIZE = 12;
const MOVEMENT_PAGE_SIZE = 15;

type InventoryFilters = {
  q?: string;
  stock?: string;
  page?: number;
};

type MovementFilters = {
  q?: string;
  movementType?: string;
  page?: number;
};

type VariantRelationRow = ProductVariantRow & {
  products?: {
    name: string;
    sku: string;
    categories?: { name: string } | null;
  } | null;
};

type MovementRelationRow = StockMovementRow & {
  product_variants?: {
    variant_sku: string;
    color: string;
    size: string;
    products?: { name: string } | null;
  } | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

export async function listInventoryVariants(
  filters: InventoryFilters = {},
): Promise<PaginatedResult<InventoryVariantItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("product_variants")
    .select("*, products!inner(name, sku, categories(name))", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.q?.trim()) {
    const search = filters.q.trim();
    query = query.or(`variant_sku.ilike.%${search}%,barcode.ilike.%${search}%,color.ilike.%${search}%,size.ilike.%${search}%`);
  }

  if (filters.stock === "low") {
    query = query.gt("stock_quantity", 0).filter("stock_quantity", "lte", "minimum_stock");
  }

  if (filters.stock === "out") {
    query = query.eq("stock_quantity", 0);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as VariantRelationRow[];

  return {
    data: rows.map((row) => ({
      ...row,
      product_name: row.products?.name ?? "Unknown product",
      product_sku: row.products?.sku ?? "",
      category_name: row.products?.categories?.name ?? null,
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function listStockMovements(
  filters: MovementFilters = {},
): Promise<PaginatedResult<StockMovementItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * MOVEMENT_PAGE_SIZE;
  const to = from + MOVEMENT_PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: MOVEMENT_PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("stock_movements")
    .select("*, product_variants!inner(variant_sku, color, size, products(name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.movementType && filters.movementType !== "all") {
    query = query.eq("movement_type", filters.movementType as StockMovementType);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as MovementRelationRow[];
  const search = filters.q?.trim().toLowerCase();

  const mapped = rows.map<StockMovementItem>((row) => ({
    ...row,
    product_name: row.product_variants?.products?.name ?? "Unknown product",
    variant_sku: row.product_variants?.variant_sku ?? "",
    color: row.product_variants?.color ?? "",
    size: row.product_variants?.size ?? "",
  }));

  return {
    data: search
      ? mapped.filter((row) =>
          `${row.product_name} ${row.variant_sku} ${row.color} ${row.size}`.toLowerCase().includes(search),
        )
      : mapped,
    count: count ?? 0,
    page,
    pageSize: MOVEMENT_PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / MOVEMENT_PAGE_SIZE),
  };
}

export async function addStock(input: StockEntryInput): Promise<ServiceResult<StockMovementRow>> {
  const parsed = stockEntrySchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canAdjustInventory, "add stock");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.rpc("add_variant_stock", {
    p_variant_id: parsed.data.productVariantId,
    p_quantity: parsed.data.quantity,
    p_movement_type: parsed.data.movementType,
    p_reference_type: parsed.data.referenceType,
    p_reference_id: parsed.data.referenceId ?? null,
    p_note: parsed.data.note,
  });

  if (error || !data) {
    return serviceError("Stock could not be added. Please try again.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  revalidatePath("/admin/products");
  return serviceSuccess(data);
}

export async function adjustStock(input: StockAdjustmentInput): Promise<ServiceResult<StockMovementRow>> {
  const parsed = stockAdjustmentSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canAdjustInventory, "adjust stock");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.rpc("adjust_variant_stock", {
    p_variant_id: parsed.data.productVariantId,
    p_new_quantity: parsed.data.newQuantity,
    p_reference_type: parsed.data.referenceType,
    p_reference_id: parsed.data.referenceId ?? null,
    p_note: parsed.data.note,
  });

  if (error || !data) {
    return serviceError("Stock adjustment could not be recorded. Please check the quantity and try again.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/movements");
  revalidatePath("/admin/products");
  return serviceSuccess(data);
}
