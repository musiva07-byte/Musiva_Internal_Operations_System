import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffPermission } from "@/lib/auth/authorization";
import {
  canManageProducts,
  canArchiveProducts,
  canDeleteProducts,
  canEnterBuyingCost,
  canPublishProducts,
} from "@/lib/auth/permissions";
import { PRODUCT_STATUSES, STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { isDiscountActive } from "@/lib/pricing/calculations";
import { getValidBuyingCost } from "@/lib/utils/cost-conversion";
import { productSchema, type ProductInput } from "@/lib/validations/product.schema";
import {
  checkPublishAttempt,
  getPublishingReadiness,
  matchesWebsiteFilter,
  type WebsiteFilterValue,
} from "@/lib/validations/product-publishing";
import { convertToBhd, roundBhd } from "@/lib/utils/cost-conversion";
import { generateUniqueProductSlug } from "@/lib/utils/slug";
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
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 10;
const LOAD_ERROR = "Unable to load data. Please try again or contact the administrator.";
/** Safety cap for the unpaginated scan used by the "Website" filter (see listProducts). */
const WEBSITE_FILTER_SCAN_LIMIT = 1000;

type ProductListFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  page?: number;
  websiteFilter?: WebsiteFilterValue;
};

/**
 * Resolve the slug to save for a product: keep an explicitly-provided slug
 * (validating it's not used by another product), or auto-generate one from
 * the name/SKU when left blank. Never regenerates a slug the product
 * already has unless the caller explicitly submitted a new value — the
 * edit form always round-trips the current slug, so a no-op edit results
 * in the same value here.
 */
async function resolveProductSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  name: string,
  sku: string,
  requestedSlug: string | null | undefined,
  excludeProductId?: string,
): Promise<{ slug: string; error: null } | { slug: null; error: string }> {
  async function isTaken(candidate: string): Promise<boolean> {
    let query = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (excludeProductId) {
      query = query.neq("id", excludeProductId);
    }
    const { count } = await query;
    return (count ?? 0) > 0;
  }

  if (requestedSlug) {
    if (await isTaken(requestedSlug)) {
      return {
        slug: null,
        error: `The slug "${requestedSlug}" is already used by another product. Choose a different one.`,
      };
    }
    return { slug: requestedSlug, error: null };
  }

  const generated = await generateUniqueProductSlug(name, sku, isTaken);
  return { slug: generated, error: null };
}

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
  const websiteFilter = filters.websiteFilter ?? "";

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  const search = normalizeSearch(filters.q);
  let query = supabase
    .from("products")
    .select("*, categories(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

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

  // The "Website" filter (published/draft/hidden/missing details) is
  // partly derived (missing_details depends on variants/images, not a
  // single column), so it can't always be pushed down as a plain .eq().
  // Instead, when this filter is active, fetch a capped, unpaginated batch
  // matching every other filter and paginate the already-filtered result
  // in JS below. Boutique catalog sizes make this bounded and safe; the
  // normal (no website filter) path is untouched and still paginates in SQL.
  query = websiteFilter ? query.limit(WEBSITE_FILTER_SCAN_LIMIT) : query.range(from, to);

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
          .select("id, product_id, variant_sku, color, size, stock_quantity, minimum_stock, selling_price, discount_price, discount_price_bhd, discount_start_at, discount_end_at, status, regular_selling_price_bhd, latest_supplier_unit_cost_inr, latest_exchange_rate_to_bhd")
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

    const websiteReady = getPublishingReadiness({
      name: product.name,
      slug: product.slug,
      variants: variantRows.map((v) => ({
        status: v.status,
        stockQuantity: v.stock_quantity,
        regularSellingPriceBhd:
          v.regular_selling_price_bhd === null ? null : Number(v.regular_selling_price_bhd),
      })),
      hasImage: Boolean(primaryImage),
    }).ready;

    let validCostCount = 0;
    let missingCostCount = 0;
    let totalBuyingValueInr = 0;
    let totalFinalCostBhd = 0;
    let totalSellingValueBhd = 0;
    const variantCostRows: ProductListItem["cost_summary"]["variants"] = [];
    for (const variant of variantRows) {
      const cost = getValidBuyingCost(variant);
      const sellingPriceBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);
      if (cost) {
        validCostCount += 1;
        totalBuyingValueInr += cost.buyingPriceInr * variant.stock_quantity;
        totalFinalCostBhd += cost.finalUnitCostBhd * variant.stock_quantity;
        totalSellingValueBhd += sellingPriceBhd * variant.stock_quantity;
      } else {
        missingCostCount += 1;
      }
      variantCostRows.push({
        id: variant.id,
        color: variant.color,
        size: variant.size,
        stockQuantity: variant.stock_quantity,
        buyingPriceInr: cost?.buyingPriceInr ?? null,
        exchangeRateToBhd: cost?.exchangeRateToBhd ?? null,
        convertedUnitCostBhd: cost?.convertedUnitCostBhd ?? null,
        additionalLandedCostBhd: cost?.additionalLandedCostBhd ?? null,
        finalUnitCostBhd: cost?.finalUnitCostBhd ?? null,
        sellingPriceBhd,
      });
    }

    return {
      ...product,
      category_name: product.categories?.name ?? null,
      primary_image_url: primaryImage?.url ?? null,
      variant_count: variantRows.length,
      total_stock: variantRows.reduce((sum, variant) => sum + variant.stock_quantity, 0),
      low_stock_count: lowStockCount,
      out_of_stock_count: variantRows.filter((variant) => variant.stock_quantity === 0).length,
      min_selling_price: activePrices.length ? Math.min(...activePrices) : null,
      max_selling_price: activePrices.length ? Math.max(...activePrices) : null,
      has_active_discount: hasActiveDiscount,
      variants_quick: variantsQuick,
      website_ready: websiteReady,
      cost_summary: {
        validCostCount,
        missingCostCount,
        totalBuyingValueInr,
        totalFinalCostBhd,
        totalSellingValueBhd,
        variants: variantCostRows,
      },
    };
  });

  if (websiteFilter) {
    const filtered = data.filter((product) => matchesWebsiteFilter(product, websiteFilter));
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    return {
      data: filtered.slice(start, start + PAGE_SIZE),
      count: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      pageCount,
    };
  }

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

  const slugResult = await resolveProductSlug(
    supabase,
    productInput.name,
    productInput.sku,
    productInput.slug,
  );
  if (slugResult.error) {
    return serviceError(slugResult.error);
  }

  const wantsPublished =
    productInput.onlineStatus === "published" || productInput.websiteVisible === true;
  const readiness = getPublishingReadiness({
    name: productInput.name,
    slug: slugResult.slug,
    variants: productInput.variants.map((v) => ({
      status: v.status,
      stockQuantity: v.stockQuantity,
      regularSellingPriceBhd: v.regularSellingPriceBhd,
    })),
    hasImage: productInput.images.length > 0,
  });
  const publishCheck = checkPublishAttempt({
    wantsPublished,
    canPublish: canPublishProducts(auth.role),
    readiness,
  });
  if (!publishCheck.ok) {
    return serviceError(publishCheck.error);
  }

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
      slug: slugResult.slug,
      website_visible: productInput.websiteVisible,
      online_status: productInput.onlineStatus,
      website_title: productInput.websiteTitle ?? null,
      website_description: productInput.websiteDescription ?? null,
      seo_title: productInput.seoTitle ?? null,
      seo_description: productInput.seoDescription ?? null,
      featured: productInput.featured,
      new_arrival: productInput.newArrival,
      sort_order: productInput.sortOrder,
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
    const variantAdditionalCost = variant.additionalLandedCostBhd ?? 0;

    // Converted buying price is a pure currency conversion. The optional additional landed
    // cost (cargo/customs/packaging/etc — staff-entered, defaults to 0, never required) is
    // added on top to get the final buying cost. "Landed cost" columns are reused for the
    // final BHD figure so the existing weighted-average-cost RPC keeps working unchanged
    // when a later purchase order also receives stock for this variant.
    let convertedUnitCostBhd: number | null = null;
    let finalUnitCostBhd: number | null = null;
    if (openingCost && variantBuyingPrice > 0) {
      convertedUnitCostBhd = roundBhd(convertToBhd(variantBuyingPrice, openingCost.exchangeRateToBhd));
      finalUnitCostBhd = roundBhd(convertedUnitCostBhd + variantAdditionalCost);
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
        latest_landed_cost_bhd: finalUnitCostBhd,
        average_landed_cost_bhd: finalUnitCostBhd,
        latest_supplier_unit_cost_inr: finalUnitCostBhd != null ? variantBuyingPrice : null,
        latest_exchange_rate_to_bhd: finalUnitCostBhd != null ? openingCost!.exchangeRateToBhd : null,
        latest_additional_landed_cost_bhd: finalUnitCostBhd != null ? variantAdditionalCost : 0,
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
      if (finalUnitCostBhd != null && convertedUnitCostBhd != null && openingCost) {
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
          converted_unit_cost_bhd: convertedUnitCostBhd,
          allocated_import_cost_bhd: variantAdditionalCost,
          landed_unit_cost_bhd: finalUnitCostBhd,
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
      has_opening_cost:
        openingCost != null &&
        productInput.variants.some((v) => (v.buyingPriceInr ?? 0) > 0 || openingCost.buyingPricePerPiece > 0),
    },
  });

  if (wantsPublished) {
    await createAuditLog({
      action: "publish_product",
      tableName: "products",
      recordId: product.id,
      userId: auth.userId,
      metadata: { sku: product.sku, online_status: product.online_status },
    });
  }

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

  const { data: existingProduct } = await supabase
    .from("products")
    .select("website_visible, online_status")
    .eq("id", productId)
    .maybeSingle();
  const wasPublished =
    existingProduct?.online_status === "published" || existingProduct?.website_visible === true;

  const slugResult = await resolveProductSlug(
    supabase,
    productInput.name,
    productInput.sku,
    productInput.slug,
    productId,
  );
  if (slugResult.error) {
    return serviceError(slugResult.error);
  }

  const wantsPublished =
    productInput.onlineStatus === "published" || productInput.websiteVisible === true;
  const readiness = getPublishingReadiness({
    name: productInput.name,
    slug: slugResult.slug,
    variants: productInput.variants.map((v) => ({
      status: v.status,
      stockQuantity: v.stockQuantity,
      regularSellingPriceBhd: v.regularSellingPriceBhd,
    })),
    hasImage: productInput.images.length > 0,
  });
  const publishCheck = checkPublishAttempt({
    wantsPublished,
    canPublish: canPublishProducts(auth.role),
    readiness,
  });
  if (!publishCheck.ok) {
    return serviceError(publishCheck.error);
  }

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
      slug: slugResult.slug,
      website_visible: productInput.websiteVisible,
      online_status: productInput.onlineStatus,
      website_title: productInput.websiteTitle ?? null,
      website_description: productInput.websiteDescription ?? null,
      seo_title: productInput.seoTitle ?? null,
      seo_description: productInput.seoDescription ?? null,
      featured: productInput.featured,
      new_arrival: productInput.newArrival,
      sort_order: productInput.sortOrder,
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
          latest_supplier_unit_cost_inr: null,
          latest_exchange_rate_to_bhd: null,
          latest_additional_landed_cost_bhd: 0,
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

  if (wantsPublished && !wasPublished) {
    await createAuditLog({
      action: "publish_product",
      tableName: "products",
      recordId: product.id,
      userId: auth.userId,
      metadata: { sku: product.sku, online_status: product.online_status },
    });
  } else if (!wantsPublished && wasPublished) {
    await createAuditLog({
      action: "unpublish_product",
      tableName: "products",
      recordId: product.id,
      userId: auth.userId,
      metadata: { sku: product.sku, online_status: product.online_status },
    });
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
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
