import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageProducts, canArchiveProducts, canDeleteProducts, canEnterBuyingCost } from "@/lib/auth/permissions";
import { PRODUCT_STATUSES, STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { isDiscountActive } from "@/lib/pricing/calculations";
import { productSchema, type ProductInput } from "@/lib/validations/product.schema";
import { convertToBhd, calcLandedCost, roundBhd } from "@/lib/utils/cost-conversion";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type {
  CategoryRow,
  ProductImageRow,
  ProductRow,
  ProductStatus,
  ProductVariantRow,
} from "@/types/database";
import type { PaginatedResult, ProductListItem, ProductWithRelations, VariantQuick } from "@/types/app";

const PAGE_SIZE = 10;
const LOAD_ERROR = "Unable to load data. Please try again or contact the administrator.";

type ProductListFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  page?: number;
};

type ProductRelationRow = ProductRow & {
  categories?: Pick<CategoryRow, "id" | "name"> | null;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

function normalizeSearch(value: string | undefined) {
  return value?.trim() || undefined;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("status", PRODUCT_STATUSES.active)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}

export async function listProducts(
  filters: ProductListFilters = {},
): Promise<PaginatedResult<ProductListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  const search = normalizeSearch(filters.q);
  let query = supabase
    .from("products")
    .select("*, categories(id, name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,collection.ilike.%${search}%`);
  }

  // Default: show active + inactive (exclude archived).
  // Pass status="archived" to see only archived, status="all" to see everything.
  if (!filters.status || filters.status === "active_inactive") {
    query = query.in("status", [PRODUCT_STATUSES.active, PRODUCT_STATUSES.inactive, PRODUCT_STATUSES.draft]);
  } else if (filters.status !== "all") {
    query = query.eq("status", filters.status as ProductStatus);
  }

  if (filters.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }

  const { data: products, count, error } = await query;
  if (error) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }
  const rows = (products ?? []) as unknown as ProductRelationRow[];
  const productIds = rows.map((product) => product.id);

  const [variantResult, imageResult] = await Promise.all([
    (productIds.length
      ? supabase
          .from("product_variants")
          .select("id, product_id, variant_sku, color, size, stock_quantity, minimum_stock, selling_price, discount_price, discount_price_bhd, discount_start_at, discount_end_at, status, regular_selling_price_bhd")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as ProductVariantRow[] })) as unknown as Promise<{ data: ProductVariantRow[] | null }>,
    productIds.length
      ? supabase
          .from("product_images")
          .select("id, product_id, url, is_primary, sort_order")
          .in("product_id", productIds)
          .eq("is_primary", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as ProductImageRow[] }),
  ]);

  if ("error" in variantResult && variantResult.error) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }

  if ("error" in imageResult && imageResult.error) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0, loadError: LOAD_ERROR };
  }

  const productVariants = variantResult.data ?? [];
  const primaryImages = imageResult.data ?? [];

  const data = rows.map<ProductListItem>((product) => {
    const variantRows = productVariants.filter((variant) => variant.product_id === product.id);
    const primaryImage = primaryImages.find((image) => image.product_id === product.id);
    const activePrices = variantRows
      .map((variant) => Number(variant.regular_selling_price_bhd ?? variant.selling_price))
      .filter((price) => price >= 0);
    const lowStockCount = variantRows.filter(
      (variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.minimum_stock,
    ).length;
    const hasActiveDiscount = variantRows.some((variant) => isDiscountActive(variant));

    const variantsQuick: VariantQuick[] = variantRows.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      stock_quantity: v.stock_quantity,
    }));

    return {
      ...product,
      category_name: product.categories?.name ?? null,
      primary_image_url: primaryImage?.url ?? null,
      variant_count: variantRows.length,
      total_stock: variantRows.reduce((sum, variant) => sum + variant.stock_quantity, 0),
      low_stock_count: lowStockCount,
      out_of_stock_count: variantRows.filter((variant) => variant.stock_quantity === 0).length,
      min_selling_price: activePrices.length ? Math.min(...activePrices) : null,
      has_active_discount: hasActiveDiscount,
      variants_quick: variantsQuick,
    };
  });

  return {
    data,
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getProduct(productId: string): Promise<ProductWithRelations | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: product } = await supabase
    .from("products")
    .select("*, categories(id, name)")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return null;
  }

  const typedProduct = product as unknown as ProductRelationRow;
  const [{ data: variants }, { data: images }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("color", { ascending: true })
      .order("size", { ascending: true }),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  return {
    ...typedProduct,
    category: typedProduct.categories ?? null,
    variants: variants ?? [],
    images: images ?? [],
  };
}

export async function createProduct(input: ProductInput): Promise<ServiceResult<ProductRow>> {
  const parsed = productSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canManageProducts, "manage products");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supabase = auth.supabase;
  const productInput = parsed.data;

  // Buying cost is only processed when the user has the required permission.
  // If a lower-privilege user somehow sends cost data it is silently stripped.
  const openingCost =
    productInput.openingCost && canEnterBuyingCost(auth.role)
      ? productInput.openingCost
      : null;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: productInput.name,
      sku: productInput.sku,
      category_id: productInput.categoryId ?? null,
      collection: productInput.collection ?? null,
      description: productInput.description ?? null,
      material: productInput.material ?? null,
      care_instructions: productInput.careInstructions ?? null,
      status: productInput.status,
    })
    .select()
    .single();

  if (productError || !product) {
    return serviceError("Product could not be created. Please check the SKU and try again.");
  }

  for (const variant of productInput.variants) {
    // Per-variant buying price takes priority over the shared (legacy) price.
    const variantBuyingPrice =
      (variant.buyingPriceInr ?? 0) > 0
        ? variant.buyingPriceInr!
        : (openingCost?.buyingPricePerPiece ?? 0);

    // Compute landed cost for this variant (explicit override takes final priority).
    let landedCostBhd: number | null = null;
    let convertedCostBhd: number | null = null;
    if (openingCost && variantBuyingPrice > 0) {
      convertedCostBhd = roundBhd(
        convertToBhd(variantBuyingPrice, openingCost.exchangeRateToBhd),
      );
      landedCostBhd =
        variant.landedCostOverrideBhd != null
          ? roundBhd(variant.landedCostOverrideBhd)
          : roundBhd(calcLandedCost(convertedCostBhd, openingCost.extraImportCostBhd));
    } else if (variant.landedCostOverrideBhd != null) {
      // Variant has an override even without global cost (edge case).
      landedCostBhd = roundBhd(variant.landedCostOverrideBhd);
    }

    const { data: createdVariant, error: variantError } = await supabase
      .from("product_variants")
      .insert({
        product_id: product.id,
        variant_sku: variant.variantSku,
        barcode: variant.barcode ?? null,
        color: variant.color,
        size: variant.size,
        cost_price: variant.costPrice,
        selling_price: variant.sellingPrice,
        discount_price: variant.discountPrice ?? null,
        regular_selling_price_bhd: variant.regularSellingPriceBhd ?? variant.sellingPrice,
        discount_price_bhd: variant.discountPriceBhd ?? null,
        discount_start_at: variant.discountStartAt ?? null,
        discount_end_at: variant.discountEndAt ?? null,
        latest_landed_cost_bhd: landedCostBhd,
        average_landed_cost_bhd: landedCostBhd,
        stock_quantity: 0,
        minimum_stock: variant.minimumStock,
        status: variant.status,
      })
      .select()
      .single();

    if (variantError || !createdVariant) {
      return serviceError("Product variant could not be created. Please check SKU and barcode values.");
    }

    if (variant.stockQuantity > 0) {
      const { error: stockError } = await supabase.rpc("add_variant_stock", {
        p_variant_id: createdVariant.id,
        p_quantity: variant.stockQuantity,
        p_movement_type: STOCK_MOVEMENT_TYPES.openingStock,
        p_reference_type: "product",
        p_reference_id: product.id,
        p_note: "Opening stock from product creation.",
      });

      if (stockError) {
        return serviceError("Opening stock could not be recorded. Product was created but stock needs review.");
      }

      // If we have cost data, record an opening-stock inventory batch.
      if (landedCostBhd != null && openingCost) {
        await supabase.from("inventory_batches").insert({
          purchase_order_item_id: null,
          product_variant_id: createdVariant.id,
          quantity_received: variant.stockQuantity,
          quantity_remaining: variant.stockQuantity,
          supplier_unit_cost: variantBuyingPrice,
          supplier_currency: openingCost.buyingCurrency,
          // Store in multiply direction (BHD per INR = spec convention).
          exchange_rate_to_bhd: openingCost.exchangeRateToBhd,
          exchange_rate_date: openingCost.exchangeRateDate,
          exchange_rate_source: openingCost.exchangeRateSource,
          converted_unit_cost_bhd: convertedCostBhd,
          allocated_import_cost_bhd: openingCost.extraImportCostBhd,
          landed_unit_cost_bhd: landedCostBhd,
          batch_type: "opening_stock",
          received_at: new Date().toISOString(),
        });
      }
    }
  }

  if (productInput.images.length > 0) {
    await supabase.from("product_images").insert(
      productInput.images.map((image) => ({
        product_id: product.id,
        variant_id: image.variantId ?? null,
        url: image.url,
        path: image.path,
        is_primary: image.isPrimary,
        sort_order: image.sortOrder,
      })),
    );
  }

  await createAuditLog({
    action: "create_product",
    tableName: "products",
    recordId: product.id,
    userId: auth.userId,
    metadata: {
      sku: product.sku,
      variants: productInput.variants.length,
      has_opening_cost: openingCost != null && openingCost.buyingPricePerPiece > 0,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return serviceSuccess(product);
}

export async function updateProduct(productId: string, input: ProductInput): Promise<ServiceResult<ProductRow>> {
  const parsed = productSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canManageProducts, "manage products");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supabase = auth.supabase;
  const productInput = parsed.data;
  const { data: product, error: productError } = await supabase
    .from("products")
    .update({
      name: productInput.name,
      sku: productInput.sku,
      category_id: productInput.categoryId ?? null,
      collection: productInput.collection ?? null,
      description: productInput.description ?? null,
      material: productInput.material ?? null,
      care_instructions: productInput.careInstructions ?? null,
      status: productInput.status,
    })
    .eq("id", productId)
    .select()
    .single();

  if (productError || !product) {
    return serviceError("Product could not be updated.");
  }

  for (const variant of productInput.variants) {
    if (variant.id) {
      const { error: variantError } = await supabase
        .from("product_variants")
        .update({
          variant_sku: variant.variantSku,
          barcode: variant.barcode ?? null,
          color: variant.color,
          size: variant.size,
          cost_price: variant.costPrice,
          selling_price: variant.sellingPrice,
          discount_price: variant.discountPrice ?? null,
          regular_selling_price_bhd: variant.regularSellingPriceBhd ?? variant.sellingPrice,
          discount_price_bhd: variant.discountPriceBhd ?? null,
          discount_start_at: variant.discountStartAt ?? null,
          discount_end_at: variant.discountEndAt ?? null,
          minimum_stock: variant.minimumStock,
          status: variant.status,
        })
        .eq("id", variant.id)
        .eq("product_id", productId);

      if (variantError) {
        return serviceError("One or more variants could not be updated.");
      }
    } else {
      const { data: createdVariant, error: variantError } = await supabase
        .from("product_variants")
        .insert({
          product_id: productId,
          variant_sku: variant.variantSku,
          barcode: variant.barcode ?? null,
          color: variant.color,
          size: variant.size,
          cost_price: variant.costPrice,
          selling_price: variant.sellingPrice,
          discount_price: variant.discountPrice ?? null,
          regular_selling_price_bhd: variant.regularSellingPriceBhd ?? variant.sellingPrice,
          discount_price_bhd: variant.discountPriceBhd ?? null,
          discount_start_at: variant.discountStartAt ?? null,
          discount_end_at: variant.discountEndAt ?? null,
          latest_landed_cost_bhd: null,
          average_landed_cost_bhd: null,
          stock_quantity: 0,
          minimum_stock: variant.minimumStock,
          status: variant.status,
        })
        .select()
        .single();

      if (variantError || !createdVariant) {
        return serviceError("A new variant could not be added.");
      }

      if (variant.stockQuantity > 0) {
        const { error: stockError } = await supabase.rpc("add_variant_stock", {
          p_variant_id: createdVariant.id,
          p_quantity: variant.stockQuantity,
          p_movement_type: STOCK_MOVEMENT_TYPES.openingStock,
          p_reference_type: "product",
          p_reference_id: productId,
          p_note: "Opening stock from new variant creation.",
        });

        if (stockError) {
          return serviceError("Opening stock for a new variant could not be recorded.");
        }
      }
    }
  }

  await createAuditLog({
    action: "update_product",
    tableName: "products",
    recordId: product.id,
    userId: auth.userId,
    metadata: {
      sku: product.sku,
      variants: productInput.variants.length,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/inventory");
  return serviceSuccess(product);
}

// ─── Product lifecycle: archive / restore / delete ────────────────────────────

export type DeletabilityResult = {
  canDelete: boolean;
  blockers: string[];
};

/**
 * Server-side safety check. Returns what's blocking deletion (if anything).
 * Does NOT require auth — this is a read-only informational query.
 */
export async function canDeleteProduct(productId: string): Promise<DeletabilityResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { canDelete: false, blockers: ["System unavailable."] };

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, stock_quantity")
    .eq("product_id", productId);

  if (!variants || variants.length === 0) {
    return { canDelete: true, blockers: [] };
  }

  const variantIds = variants.map((v) => v.id);
  const blockers: string[] = [];

  const [
    { count: orderCount },
    { count: movementCount },
    { count: purchaseCount },
    { count: returnCount },
  ] = await Promise.all([
    supabase.from("order_items").select("*", { count: "exact", head: true }).in("product_variant_id", variantIds),
    supabase.from("stock_movements").select("*", { count: "exact", head: true }).in("product_variant_id", variantIds),
    supabase.from("purchase_order_items").select("*", { count: "exact", head: true }).in("product_variant_id", variantIds),
    supabase.from("return_items").select("*", { count: "exact", head: true }).in("product_variant_id", variantIds),
  ]);

  if (orderCount && orderCount > 0) blockers.push("sales history");
  if (movementCount && movementCount > 0) blockers.push("stock movement history");
  if (purchaseCount && purchaseCount > 0) blockers.push("purchase history");
  if (returnCount && returnCount > 0) blockers.push("return history");
  if (variants.some((v) => v.stock_quantity > 0)) blockers.push("available stock");

  return { canDelete: blockers.length === 0, blockers };
}

/** Archive a product and all its variants. Preserves all history. */
export async function archiveProduct(productId: string): Promise<ServiceResult<ProductRow>> {
  const auth = await requireStaffPermission(canArchiveProducts, "archive products");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to archive products.");
  }

  const { data: product, error } = await auth.supabase
    .from("products")
    .update({ status: PRODUCT_STATUSES.archived })
    .eq("id", productId)
    .select()
    .single();

  if (error || !product) {
    return serviceError("Product could not be archived. Please try again.");
  }

  await auth.supabase
    .from("product_variants")
    .update({ status: PRODUCT_STATUSES.archived })
    .eq("product_id", productId);

  await createAuditLog({
    action: "product_archived",
    tableName: "products",
    recordId: productId,
    userId: auth.userId,
    metadata: { name: product.name, sku: product.sku },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/inventory");
  return serviceSuccess(product);
}

/** Restore an archived product and its variants to active or inactive. */
export async function restoreProduct(
  productId: string,
  targetStatus: "active" | "inactive" = "active",
): Promise<ServiceResult<ProductRow>> {
  const auth = await requireStaffPermission(canArchiveProducts, "restore products");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to restore products.");
  }

  const { data: product, error } = await auth.supabase
    .from("products")
    .update({ status: targetStatus })
    .eq("id", productId)
    .select()
    .single();

  if (error || !product) {
    return serviceError("Product could not be restored. Please try again.");
  }

  await auth.supabase
    .from("product_variants")
    .update({ status: targetStatus })
    .eq("product_id", productId)
    .eq("status", PRODUCT_STATUSES.archived);

  await createAuditLog({
    action: "product_restored",
    tableName: "products",
    recordId: productId,
    userId: auth.userId,
    metadata: { name: product.name, sku: product.sku, targetStatus },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/inventory");
  return serviceSuccess(product);
}

/**
 * Permanently delete a product.
 * Only allowed when the product has no linked business records.
 * Also deletes the product image from Supabase Storage.
 */
export async function permanentDeleteProduct(productId: string): Promise<ServiceResult<{ productId: string }>> {
  const auth = await requireStaffPermission(canDeleteProducts, "permanently delete products");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to delete products.");
  }

  // Safety check — server-side, do not trust the client
  const safety = await canDeleteProduct(productId);
  if (!safety.canDelete) {
    await createAuditLog({
      action: "product_delete_blocked",
      tableName: "products",
      recordId: productId,
      userId: auth.userId,
      metadata: { blockers: safety.blockers },
    });
    return serviceError(
      "This product has " +
        safety.blockers.join(", ") +
        " and cannot be deleted. Archive it instead.",
    );
  }

  // Load product name + image path before deletion for audit log and storage cleanup
  const [{ data: product }, { data: image }] = await Promise.all([
    auth.supabase.from("products").select("name, sku").eq("id", productId).maybeSingle(),
    auth.supabase
      .from("product_images")
      .select("path")
      .eq("product_id", productId)
      .maybeSingle(),
  ]);

  // Delete the product — cascade removes variants and product_images DB records
  const { error: deleteError } = await auth.supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (deleteError) {
    return serviceError("Product could not be deleted. Please try again.");
  }

  // Delete image from Supabase Storage — fire-and-forget after DB delete succeeds
  if (image?.path) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      admin.storage.from("product-images").remove([image.path]).catch((err) => {
        console.error("[product-delete] storage cleanup failed:", err);
      });

      await createAuditLog({
        action: "product_image_deleted_on_product_delete",
        tableName: "product_images",
        recordId: productId,
        userId: auth.userId,
        metadata: { path: image.path },
      });
    }
  }

  await createAuditLog({
    action: "product_permanently_deleted",
    tableName: "products",
    recordId: productId,
    userId: auth.userId,
    metadata: { name: product?.name ?? "unknown", sku: product?.sku ?? "unknown" },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return serviceSuccess({ productId });
}
