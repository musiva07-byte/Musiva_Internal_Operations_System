import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageProducts } from "@/lib/auth/permissions";
import { normalizeImageColor } from "@/lib/utils/product-image";
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
const FRIENDLY_UPLOAD_ERROR = "Could not upload this photo. Please try again.";
const FRIENDLY_REMOVE_ERROR = "Could not remove this photo. Please try again.";
const FRIENDLY_COVER_ERROR = "Could not change the cover photo. Please try again.";

function fileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function storagePath(productId: string, filename: string): string {
  return `${productId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

/** Every image row for a product, or null if the query failed — lets a caller tell "no images"
 *  apart from "couldn't load them" so a failed refresh never blanks the Product Images section. */
export async function getProductImagesSnapshot(productId: string): Promise<ProductImageRow[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("color", { ascending: true, nullsFirst: true });

  return error ? null : (data ?? []);
}

async function loadImageRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
): Promise<ProductImageRow[]> {
  const { data, error } = await supabase.from("product_images").select("*").eq("product_id", productId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Matched on normalized color: the unique index is case-sensitive, so an exact match would let
 *  "BROWN" and "Brown" become two rows for what staff see as one color. */
function findImageForColor(rows: ProductImageRow[], color: string | null): ProductImageRow | null {
  const target = normalizeImageColor(color);
  return rows.find((row) => normalizeImageColor(row.color) === target) ?? null;
}

/** Fire-and-forget, and only once no other row points at the file. */
function removeStorageObjectIfUnreferenced(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  path: string,
  otherRows: ProductImageRow[],
) {
  if (!path || otherRows.some((row) => row.path === path)) return;
  admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
}

function revalidateImageViews(productId: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/admin/inventory");
}

/**
 * Upload a new product image (or replace the existing one). Pass `color` to manage that
 * color's image instead of the legacy main image — e.g. "Black" for the Black variants' shared
 * photo.
 *
 * Flow:
 *   1. Validate permission
 *   2. Validate file type and size
 *   3. Upload new file to Supabase Storage
 *   4. Replace: repoint the existing row at the new file, keeping its id and cover status, so
 *      a failure leaves the old photo fully intact. New: insert a row, which becomes the cover
 *      only if the product has none.
 *   5. Remove the old storage file, only after the row is updated and only if unreferenced
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
  const rows = await loadImageRows(auth.supabase, productId);
  const existing = findImageForColor(rows, normalizedColor);

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

  // ── Save the database reference ───────────────────────────────────────────────
  const { data: imageRecord, error: dbError } = existing
    ? await auth.supabase
        .from("product_images")
        .update({ url: publicUrl, path })
        .eq("id", existing.id)
        .select()
        .single()
    : await auth.supabase
        .from("product_images")
        .insert({
          product_id: productId,
          variant_id: null,
          color: normalizedColor,
          url: publicUrl,
          path,
          is_primary: !rows.some((row) => row.is_primary),
          sort_order: 0,
        })
        .select()
        .single();

  if (dbError || !imageRecord) {
    console.error("[product-image] upload: DB save error", {
      action: "upload",
      productId,
      imageType: normalizedColor ? "color" : "main",
      error: dbError?.message,
      code: dbError?.code,
    });
    // New file is uploaded but DB record failed — try to clean up the orphaned file
    admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
    return serviceError(FRIENDLY_UPLOAD_ERROR);
  }

  if (existing) {
    removeStorageObjectIfUnreferenced(
      admin,
      existing.path,
      rows.filter((row) => row.id !== existing.id),
    );
  }

  revalidateImageViews(productId);
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
 * Remove a product's image. Pass `color` to remove that color's image instead of the legacy
 * main image. Only ever deletes the one row for that color.
 *
 * Flow:
 *   1. Validate permission
 *   2. Load the product's records
 *   3. If this is the cover, move the cover to another color photo, else the legacy main image
 *      — first, so a failure leaves the product with a working cover
 *   4. Delete DB record
 *   5. Delete storage file, if no other row references it
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
  const rows = await loadImageRows(auth.supabase, productId);
  const existing = findImageForColor(rows, normalizedColor);
  if (!existing) {
    return serviceError("This product has no image to remove.");
  }

  const otherRows = rows.filter((row) => row.id !== existing.id);
  const nextCover = existing.is_primary
    ? ([...otherRows]
        .filter((row) => row.color)
        .sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""))[0] ??
      otherRows.find((row) => !row.color) ??
      null)
    : null;

  if (nextCover) {
    const { error: promoteError } = await auth.supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", nextCover.id);
    if (promoteError) {
      console.error("[product-image] remove: cover fallback error", {
        action: "remove",
        productId,
        error: promoteError.message,
      });
      return serviceError(FRIENDLY_REMOVE_ERROR);
    }
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
    if (nextCover) {
      await auth.supabase.from("product_images").update({ is_primary: false }).eq("id", nextCover.id);
    }
    return serviceError(FRIENDLY_REMOVE_ERROR);
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    removeStorageObjectIfUnreferenced(admin, existing.path, otherRows);
  }

  revalidateImageViews(productId);
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

/**
 * Make one of the product's existing photos its listing cover. Reuses the photo — no upload, no
 * duplicate row — and only ever touches is_primary, so it can't affect price, stock, or
 * publishing. The new cover is set before the old one is cleared, so the product is never
 * without a cover; if clearing fails the change is undone.
 */
async function setProductCoverImageInternal(
  productId: string,
  imageId: string,
): Promise<ServiceResult<{ productId: string }>> {
  const auth = await requireStaffPermission(canManageProducts, "change the cover photo");
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to change the cover photo.");
  }

  const rows = await loadImageRows(auth.supabase, productId);
  const target = rows.find((row) => row.id === imageId);
  if (!target) {
    return serviceError(FRIENDLY_COVER_ERROR);
  }

  const previousCovers = rows.filter((row) => row.is_primary && row.id !== imageId);

  if (!target.is_primary) {
    const { error } = await auth.supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);
    if (error) {
      console.error("[product-image] cover: set error", { productId, error: error.message });
      return serviceError(FRIENDLY_COVER_ERROR);
    }
  }

  if (previousCovers.length > 0) {
    const { error } = await auth.supabase
      .from("product_images")
      .update({ is_primary: false })
      .in("id", previousCovers.map((row) => row.id));
    if (error) {
      console.error("[product-image] cover: clear error", { productId, error: error.message });
      if (!target.is_primary) {
        await auth.supabase.from("product_images").update({ is_primary: false }).eq("id", imageId);
      }
      return serviceError(FRIENDLY_COVER_ERROR);
    }
  }

  revalidateImageViews(productId);
  return serviceSuccess({ productId });
}

export async function setProductCoverImage(
  productId: string,
  imageId: string,
): Promise<ServiceResult<{ productId: string }>> {
  try {
    return await setProductCoverImageInternal(productId, imageId);
  } catch (err) {
    console.error("[product-image] cover: unexpected exception", {
      productId,
      error: err instanceof Error ? err.message : String(err),
    });
    return serviceError(FRIENDLY_COVER_ERROR);
  }
}
