"use server";

import { uploadProductImage, removeProductImage } from "@/lib/services/product-image.service";

const FRIENDLY_UPLOAD_ERROR = "Could not upload image. Please try again.";
const FRIENDLY_REMOVE_ERROR = "Could not remove image. Please try again.";

/**
 * Upload or replace a product image. Expects FormData with a "file" field containing the
 * image File. Pass `color` to manage that color's image instead of the main image.
 *
 * Always resolves with a structured { ok, error } result — never throws/rejects — so a
 * Server Action failure can never surface as an uncaught error in the calling Client
 * Component (which would otherwise render the global error page instead of a friendly inline
 * message). uploadProductImage() already catches its own expected and unexpected failures;
 * the try/catch here is a second line of defense in case anything above it (e.g. reading the
 * FormData) throws.
 */
export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
  color?: string | null,
): Promise<{ ok: boolean; error?: string | null; url?: string | null }> {
  try {
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return { ok: false, error: "No file provided." };
    }

    const result = await uploadProductImage(productId, file, color);

    if (result.error || !result.data) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null, url: result.data.url };
  } catch (err) {
    console.error("[image-actions] uploadProductImageAction: unexpected exception", {
      productId,
      imageType: color?.trim() ? "color" : "main",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: FRIENDLY_UPLOAD_ERROR };
  }
}

/**
 * Remove a product image. Pass `color` to remove that color's image instead of the main
 * image. Same never-throws contract as uploadProductImageAction() above.
 */
export async function removeProductImageAction(
  productId: string,
  color?: string | null,
): Promise<{ ok: boolean; error?: string | null }> {
  try {
    const result = await removeProductImage(productId, color);

    if (result.error) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null };
  } catch (err) {
    console.error("[image-actions] removeProductImageAction: unexpected exception", {
      productId,
      imageType: color?.trim() ? "color" : "main",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: FRIENDLY_REMOVE_ERROR };
  }
}
