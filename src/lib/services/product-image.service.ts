import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageProducts } from "@/lib/auth/permissions";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ProductImageRow } from "@/types/database";

const STORAGE_BUCKET = "product-images";
// Vercel Functions hard-cap every request body at 4.5 MB — an infrastructure limit that
// next.config.ts's serverActions.bodySizeLimit cannot raise (see next.config.ts). Our own
// limit must stay comfortably under that so a real, app-accepted upload can never be rejected
// by the platform itself before it reaches our error handling.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

// Friendly, staff-facing messages — never the raw Supabase/Postgres error text.
const FRIENDLY_TYPE_ERROR = "Please upload a JPG, PNG, or WebP image.";
const FRIENDLY_SIZE_ERROR = "Image is too large. Please upload an image under 4 MB.";
const FRIENDLY_STORAGE_UNAVAILABLE = "Image storage is not available. Please contact the administrator.";
const FRIENDLY_UPLOAD_ERROR = "Could not upload image. Please try again.";
const FRIENDLY_REMOVE_ERROR = "Could not remove image. Please try again.";

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
 *  color (color set) — the one row the new upload/remove call should replace. `limit(1)`
 *  is defense in depth: the DB already enforces at most one row per (product, color-or-null)
 *  via partial unique indexes (uniq_product_images_main / uniq_product_images_color), but
 *  capping the query here means a `.maybeSingle()` can never itself error out with "multiple
 *  rows returned" even if that guarantee were ever violated in a given environment. */
async function findExistingImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
  color: string | null,
): Promise<ProductImageRow | null> {
  let query = supabase.from("product_images").select("*").eq("product_id", productId);
  query = color ? query.eq("color", color) : query.is("color", null);
  const { data } = await query.limit(1).maybeSingle();
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
 *
 * Every expected failure (permission, validation, storage, DB) returns a structured
 * ServiceResult with a friendly message — this function never throws for those cases. Only a
 * genuinely unexpected exception (network blip, malformed client, etc.) is caught by the
 * uploadProductImage() wrapper below, logged with context, and turned into the same friendly
 * shape so the caller (a Server Action) never rejects and the UI never has to render the
 * global error page for an image action.
 */
async function uploadProductImageInternal(
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
    return serviceError(FRIENDLY_TYPE_ERROR);
  }
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return serviceError(FRIENDLY_TYPE_ERROR);
  }
  if (file.size > MAX_FILE_SIZE) {
    return serviceError(FRIENDLY_SIZE_ERROR);
  }
  if (file.size === 0) {
    return serviceError("The selected file is empty.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("[product-image] upload: admin client unavailable (missing service role env)", {
      action: "upload",
      productId,
      imageType: normalizedColor ? "color" : "main",
    });
    return serviceError(FRIENDLY_STORAGE_UNAVAILABLE);
  }

  // ── Ensure the bucket exists (creates it if missing) ─────────────────────────
  const { error: bucketError } = await admin.storage.createBucket(STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
  // A bucket that already exists is fine — matched loosely since Supabase Storage's exact
  // wording for "already exists" varies by version ("The resource already exists", "Duplicate",
  // 409 Conflict, ...). Any other error is a real problem.
  if (bucketError) {
    const message = bucketError.message?.toLowerCase() ?? "";
    if (!message.includes("exist") && !message.includes("duplicate")) {
      console.error("[product-image] upload: bucket create error", {
        action: "upload",
        productId,
        imageType: normalizedColor ? "color" : "main",
        error: bucketError.message,
      });
      return serviceError(FRIENDLY_STORAGE_UNAVAILABLE);
    }
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
    console.error("[product-image] upload: storage upload error", {
      action: "upload",
      productId,
      imageType: normalizedColor ? "color" : "main",
      fileType: file.type,
      fileSize: file.size,
      error: uploadError.message,
    });
    return serviceError(FRIENDLY_UPLOAD_ERROR);
  }

  const { data: urlData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    console.error("[product-image] upload: getPublicUrl returned no URL", {
      action: "upload",
      productId,
      imageType: normalizedColor ? "color" : "main",
      path,
    });
    // The file did upload — clean it up rather than leaving an orphaned object with no
    // reachable DB row, since we can't save a usable image record without a URL.
    admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
    return serviceError(FRIENDLY_UPLOAD_ERROR);
  }

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
    console.error("[product-image] upload: DB insert error", {
      action: "upload",
      productId,
      imageType: normalizedColor ? "color" : "main",
      error: dbError?.message,
      code: dbError?.code,
    });
    // New file is uploaded but DB record failed — try to clean up the orphaned file
    admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
    return serviceError("Image was uploaded but could not be saved. Please try again.");
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return serviceSuccess(imageRecord);
}

export async function uploadProductImage(
  productId: string,
  file: File,
  color?: string | null,
): Promise<ServiceResult<ProductImageRow>> {
  try {
    return await uploadProductImageInternal(productId, file, color);
  } catch (err) {
    console.error("[product-image] upload: unexpected exception", {
      action: "upload",
      productId,
      imageType: color?.trim() ? "color" : "main",
      error: err instanceof Error ? err.message : String(err),
    });
    return serviceError(FRIENDLY_UPLOAD_ERROR);
  }
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
 *
 * See uploadProductImage()'s doc comment — the same "never throw for expected failures,
 * catch and log the rest" contract applies here via the removeProductImage() wrapper below.
 */
async function removeProductImageInternal(
  productId: string,
  color?: string | null,
): Promise<ServiceResult<{ productId: string }>> {
  const auth = await requireStaffPermission(canManageProducts, "remove product images");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to remove product images.");
  }

  const normalizedColor = color?.trim() || null;
  const existing = await findExistingImage(auth.supabase, productId, normalizedColor);
  if (!existing) {
    return serviceError("This product has no image to remove.");
  }

  const { error: dbError } = await auth.supabase
    .from("product_images")
    .delete()
    .eq("id", existing.id);

  if (dbError) {
    console.error("[product-image] remove: DB delete error", {
      action: "remove",
      productId,
      imageType: normalizedColor ? "color" : "main",
      error: dbError.message,
      code: dbError.code,
    });
    return serviceError(FRIENDLY_REMOVE_ERROR);
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

export async function removeProductImage(
  productId: string,
  color?: string | null,
): Promise<ServiceResult<{ productId: string }>> {
  try {
    return await removeProductImageInternal(productId, color);
  } catch (err) {
    console.error("[product-image] remove: unexpected exception", {
      action: "remove",
      productId,
      imageType: color?.trim() ? "color" : "main",
      error: err instanceof Error ? err.message : String(err),
    });
    return serviceError(FRIENDLY_REMOVE_ERROR);
  }
}
