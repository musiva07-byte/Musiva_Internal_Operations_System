import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageProducts } from "@/lib/auth/permissions";
import { PRODUCT_STATUSES, STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { isDiscountActive } from "@/lib/pricing/calculations";
import { productSchema, type ProductInput } from "@/lib/validations/product.schema";
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

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as ProductStatus);
  }

  if (filters.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }

  const { data: products, count } = await query;
  const rows = (products ?? []) as unknown as ProductRelationRow[];
  const productIds = rows.map((product) => product.id);

  const [{ data: variants }, { data: images }] = await Promise.all([
    productIds.length
      ? supabase.from("product_variants").select("*").in("product_id", productIds)
      : Promise.resolve({ data: [] as ProductVariantRow[] }),
    productIds.length
      ? supabase
          .from("product_images")
          .select("*")
          .in("product_id", productIds)
          .eq("is_primary", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as ProductImageRow[] }),
  ]);

  const productVariants = variants ?? [];
  const primaryImages = images ?? [];

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
        latest_landed_cost_bhd: null,
        average_landed_cost_bhd: null,
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
