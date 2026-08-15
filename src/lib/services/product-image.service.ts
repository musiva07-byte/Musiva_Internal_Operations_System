import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageProducts } from "@/lib/auth/permissions";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ProductImageRow } from "@/types/database";

const STORAGE_BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function fileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function storagePath(productId: string, filename: string): string {
  return `${productId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

/** Fetch the product's main image (color IS NULL) — null if none. */
export async function getProductImage(productId: string): Promise<ProductImageRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .is("color", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/** Fetch every image row for a product — the main image (color null) plus any color
 *  images. Used by the Edit Product image section and by display-side fallback
 *  resolution (see resolveDisplayImageUrl in lib/utils/product-image.ts). */
export async function listProductImages(productId: string): Promise<ProductImageRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("color", { ascending: true, nullsFirst: true });

  return data ?? [];
}

/** Find the existing image row for a product's main image (color null) or a specific
 *  color (color set) — the one row the new upload/remove call should replace. */
async function findExistingImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
  color: string | null,
): Promise<ProductImageRow | null> {
  let query = supabase.from("product_images").select("*").eq("product_id", productId);
  query = color ? query.eq("color", color) : query.is("color", null);
  const { data } = await query.maybeSingle();
  return data ?? null;
}

/**
 * Upload a new product image (or replace the existing one). Pass `color` to manage that
 * color's image instead of the product's main image — e.g. "Black" for the Black variants'
 * shared photo. Omit or pass null/undefined for the main image (unchanged default).
 *
 * Flow:
 *   1. Validate permission
 *   2. Validate file type and size
 *   3. Upload new file to Supabase Storage
 *   4. Delete old DB record and storage file (if any) — AFTER new upload succeeds
 *   5. Insert new DB record
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  color?: string | null,
): Promise<ServiceResult<ProductImageRow>> {
  const normalizedColor = color?.trim() || null;

  // ── Permission ────────────────────────────────────────────────────────────────
  const auth = await requireStaffPermission(canManageProducts, "upload product images");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to upload product images.");
  }

  // ── File validation ───────────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return serviceError("Only JPEG, PNG, and WebP images are accepted.");
  }
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return serviceError("Only .jpg, .jpeg, .png, and .webp files are accepted.");
  }
  if (file.size > MAX_FILE_SIZE) {
    return serviceError("Image must be 5 MB or smaller.");
  }
  if (file.size === 0) {
    return serviceError("The selected file is empty.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return serviceError("Storage is not configured.");
  }

  // ── Ensure the bucket exists (creates it if missing) ─────────────────────────
  const { error: bucketError } = await admin.storage.createBucket(STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
  // "already exists" is fine — any other error is a real problem
  if (bucketError && !bucketError.message.includes("already exists") && !bucketError.message.includes("Duplicate")) {
    console.error("[product-image] bucket create error:", bucketError);
    return serviceError("Storage is not available. Please contact support.");
  }

  // ── Load existing image record (before upload, so we know what to clean up) ──
  const existing = await findExistingImage(auth.supabase, productId, normalizedColor);

  // ── Upload new file ───────────────────────────────────────────────────────────
  const path = storagePath(productId, file.name);
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[product-image] storage upload error:", uploadError);
    return serviceError("Image upload failed. Please try again.");
  }

  const { data: urlData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // ── Delete old record from DB (after new upload succeeds) ────────────────────
  if (existing) {
    await auth.supabase.from("product_images").delete().eq("id", existing.id);
    // Clean up old storage file — fire-and-forget; don't fail if this fails
    admin.storage.from(STORAGE_BUCKET).remove([existing.path]).catch(() => undefined);
  }

  // ── Insert new DB record ──────────────────────────────────────────────────────
  const { data: imageRecord, error: dbError } = await auth.supabase
    .from("product_images")
    .insert({
      product_id: productId,
      variant_id: null,
      color: normalizedColor,
      url: publicUrl,
      path,
      is_primary: normalizedColor === null,
      sort_order: 0,
    })
    .select()
    .single();

  if (dbError || !imageRecord) {
    console.error("[product-image] DB insert error:", dbError);
    // New file is uploaded but DB record failed — try to clean up the orphaned file
    admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
    return serviceError("Image was uploaded but could not be saved. Please try again.");
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return serviceSuccess(imageRecord);
}

/**
 * Remove a product's image. Pass `color` to remove that color's image instead of the
 * main image (unchanged default).
 *
 * Flow:
 *   1. Validate permission
 *   2. Load existing record
 *   3. Delete DB record
 *   4. Delete storage file
 */
export async function removeProductImage(
  productId: string,
  color?: string | null,
): Promise<ServiceResult<{ productId: string }>> {
  const auth = await requireStaffPermission(canManageProducts, "remove product images");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to remove product images.");
  }

  const existing = await findExistingImage(auth.supabase, productId, color?.trim() || null);
  if (!existing) {
    return serviceError("This product has no image to remove.");
  }

  const { error: dbError } = await auth.supabase
    .from("product_images")
    .delete()
    .eq("id", existing.id);

  if (dbError) {
    return serviceError("Image could not be removed. Please try again.");
  }

  // Delete from storage — fire-and-forget
  const admin = createSupabaseAdminClient();
  if (admin) {
    admin.storage.from(STORAGE_BUCKET).remove([existing.path]).catch(() => undefined);
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return serviceSuccess({ productId });
}
