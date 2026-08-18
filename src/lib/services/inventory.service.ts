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
import {
  getActiveSellingPrice,
  getPricingStatus,
  getStockStatus,
} from "@/lib/pricing/calculations";
import { resolveDisplayImageUrl } from "@/lib/utils/product-image";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { InventoryVariantItem, PaginatedResult, StockMovementItem } from "@/types/app";
import type { ProductVariantRow, StockMovementRow, StockMovementType } from "@/types/database";

const PAGE_SIZE = 12;
const MOVEMENT_PAGE_SIZE = 15;
const LOAD_ERROR = "Unable to load data. Please try again or contact the administrator.";
/** Safety cap for print/export — see EXPORT_ROW_LIMIT in product.service.ts for the same
 *  convention on the Product Catalog side. */
const EXPORT_ROW_LIMIT = 3000;

type InventoryFilters = {
  q?: string;
  stock?: string;
  /** "active" (default, excludes archived) | "archived" | "all" */
  productStatus?: string;
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

/** True when a Supabase/Postgres error is specifically "column <name> does not exist"
 *  (Postgres code 42703) for the given column — used to detect a not-yet-applied migration
 *  without swallowing unrelated query errors. */
function isMissingColumnError(error: { code?: string; message?: string }, column: string): boolean {
  return error.code === "42703" && (error.message?.includes(column) ?? false);
}

/** Pure row-shaping shared by listInventoryVariants() (paginated) and
 *  listInventoryVariantsForExport() (Print current list / Download PDF / Download CSV). */
function buildInventoryVariantItem(
  row: VariantRelationRow,
  primaryImageUrl: string | null,
): InventoryVariantItem {
  return {
    ...row,
    product_name: row.products?.name ?? "Unknown product",
    product_sku: row.products?.sku ?? "",
    category_name: row.products?.categories?.name ?? null,
    primary_image_url: primaryImageUrl,
    stock_status: getStockStatus(row.stock_quantity, row.minimum_stock),
    active_selling_price: getActiveSellingPrice(row),
    pricing_status: getPricingStatus(row),
  };
}

/**
 * Fetches the primary/color-matched image URL per row for a batch of already-loaded variant
 * rows — the same "does the color-images migration exist yet" fallback used by
 * listInventoryVariants(). Shared so the export path degrades the same way the paginated
 * page does instead of failing outright when the migration hasn't been applied.
 */
async function fetchImagesByProduct(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productIds: string[],
): Promise<{ imagesByProduct: Map<string, { url: string; color: string | null }[]>; error: unknown }> {
  type ImageRow = { product_id: string; url: string; color: string | null };
  let images: ImageRow[] = [];
  let imagesError: { code?: string; message: string } | null = null;

  if (productIds.length) {
    const withColor = await supabase
      .from("product_images")
      .select("product_id, url, color")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });

    if (withColor.error && isMissingColumnError(withColor.error, "color")) {
      console.error(
        "[inventory.service] product_images.color column missing — migration " +
          "202607171700_product_color_images.sql has not been applied. Falling back to " +
          "main-image-only display until it is applied.",
        withColor.error,
      );
      const withoutColor = await supabase
        .from("product_images")
        .select("product_id, url")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true });
      images = (withoutColor.data ?? []).map((img: { product_id: string; url: string }) => ({
        ...img,
        color: null,
      }));
      imagesError = withoutColor.error;
    } else {
      images = withColor.data ?? [];
      imagesError = withColor.error;
    }
  }

  const imagesByProduct = new Map<string, { url: string; color: string | null }[]>();
  for (const img of images) {
    const list = imagesByProduct.get(img.product_id) ?? [];
    list.push({ url: img.url, color: img.color });
    imagesByProduct.set(img.product_id, list);
  }

  return { imagesByProduct, error: imagesError };
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

  // Default: exclude archived variants (archived products archive their variants too)
  if (!filters.productStatus || filters.productStatus === "active") {
    query = query.neq("status", "archived");
  } else if (filters.productStatus === "archived") {
    query = query.eq("status", "archived");
  }
  // productStatus === "all" → no filter

  const { data, count, error } = await query;
  if (error) {
    console.error("[inventory.service] listInventoryVariants: product_variants query failed:", error);
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }
  const rows = (data ?? []) as unknown as VariantRelationRow[];

  const productIds = [...new Set(rows.map((row) => row.product_id))];
  type ImageRow = { product_id: string; url: string; color: string | null };
  let images: ImageRow[] = [];
  let imagesError: { message: string } | null = null;

  if (productIds.length) {
    const withColor = await supabase
      .from("product_images")
      .select("product_id, url, color")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });

    if (withColor.error && isMissingColumnError(withColor.error, "color")) {
      // Migration 202607171700_product_color_images.sql (adds product_images.color) has not
      // been applied yet. Degrade gracefully to the pre-migration behavior (one image per
      // product, no per-color match) instead of failing the whole page — see final report.
      console.error(
        "[inventory.service] product_images.color column missing — migration " +
          "202607171700_product_color_images.sql has not been applied. Falling back to " +
          "main-image-only display until it is applied.",
        withColor.error,
      );
      const withoutColor = await supabase
        .from("product_images")
        .select("product_id, url")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true });
      images = (withoutColor.data ?? []).map((img) => ({ ...img, color: null }));
      imagesError = withoutColor.error;
    } else {
      images = withColor.data ?? [];
      imagesError = withColor.error;
    }
  }

  if (imagesError) {
    console.error("[inventory.service] listInventoryVariants: product_images query failed:", imagesError);
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }

  const imagesByProduct = new Map<string, { url: string; color: string | null }[]>();
  for (const img of images ?? []) {
    const list = imagesByProduct.get(img.product_id) ?? [];
    list.push({ url: img.url, color: img.color });
    imagesByProduct.set(img.product_id, list);
  }

  return {
    data: rows.map((row) => ({
      ...row,
      product_name: row.products?.name ?? "Unknown product",
      product_sku: row.products?.sku ?? "",
      category_name: row.products?.categories?.name ?? null,
      primary_image_url: resolveDisplayImageUrl(imagesByProduct.get(row.product_id) ?? [], row.color),
      stock_status: getStockStatus(row.stock_quantity, row.minimum_stock),
      active_selling_price: getActiveSellingPrice(row),
      pricing_status: getPricingStatus(row),
    })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export type InventoryExportResult = {
  rows: InventoryVariantItem[];
  /** True when the export hit EXPORT_ROW_LIMIT — the file is not the complete filtered set. */
  truncated: boolean;
  error: string | null;
};

/**
 * Same filters as listInventoryVariants() (search/stock level/product status), but returns
 * every matching row up to a safety cap instead of one page — used by Print current list /
 * Download PDF / Download CSV on the Stock Management page. Column selection for cost/profit
 * fields is the caller's responsibility (gated by canViewBuyingCost/canViewCostData) — this
 * always returns the full InventoryVariantItem (it already omits nothing sensitive beyond
 * what product_variants itself stores) so permission checks stay in one place, the export
 * route, rather than duplicated into every data-fetch path.
 */
export async function listInventoryVariantsForExport(
  filters: Omit<InventoryFilters, "page"> = {},
): Promise<InventoryExportResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { rows: [], truncated: false, error: LOAD_ERROR };
  }

  let query = supabase
    .from("product_variants")
    .select("*, products!inner(name, sku, categories(name))")
    .order("updated_at", { ascending: false })
    .limit(EXPORT_ROW_LIMIT);

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

  if (!filters.productStatus || filters.productStatus === "active") {
    query = query.neq("status", "archived");
  } else if (filters.productStatus === "archived") {
    query = query.eq("status", "archived");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[inventory.service] listInventoryVariantsForExport: product_variants query failed:", error);
    return { rows: [], truncated: false, error: LOAD_ERROR };
  }
  const rows = (data ?? []) as unknown as VariantRelationRow[];
  const productIds = [...new Set(rows.map((row) => row.product_id))];

  const { imagesByProduct, error: imagesError } = await fetchImagesByProduct(supabase, productIds);
  if (imagesError) {
    console.error("[inventory.service] listInventoryVariantsForExport: product_images query failed:", imagesError);
    return { rows: [], truncated: false, error: LOAD_ERROR };
  }

  const shaped = rows.map((row) =>
    buildInventoryVariantItem(
      row,
      resolveDisplayImageUrl(imagesByProduct.get(row.product_id) ?? [], row.color),
    ),
  );

  return { rows: shaped, truncated: rows.length >= EXPORT_ROW_LIMIT, error: null };
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

  // DB-side search on joined variant columns so the count and pagination are accurate.
  // Searching on products(name) is not supported at two join levels in PostgREST;
  // variant_sku, color, and size cover the primary lookup needs.
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    query = query.or(
      `variant_sku.ilike.${q},color.ilike.${q},size.ilike.${q}`,
      { referencedTable: "product_variants" },
    );
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as MovementRelationRow[];

  const mapped = rows.map<StockMovementItem>((row) => ({
    ...row,
    product_name: row.product_variants?.products?.name ?? "Unknown product",
    variant_sku: row.product_variants?.variant_sku ?? "",
    color: row.product_variants?.color ?? "",
    size: row.product_variants?.size ?? "",
  }));

  return {
    data: mapped,
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
