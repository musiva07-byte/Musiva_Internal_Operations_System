"use server";

import {
  getProductImagesSnapshot,
  removeProductImage,
  setProductCoverImage,
  uploadProductImage,
} from "@/lib/services/product-image.service";
import type { ProductImageRow } from "@/types/database";

const FRIENDLY_UPLOAD_ERROR = "Could not upload this photo. Please try again.";
const FRIENDLY_REMOVE_ERROR = "Could not remove this photo. Please try again.";
const FRIENDLY_COVER_ERROR = "Could not change the cover photo. Please try again.";

/** `images` is the product's full image list after the change, so a removal or upload that also
 *  moved the cover shows correctly straight away. Omitted if that refresh failed. */
type ImageActionResult = {
  ok: boolean;
  error?: string | null;
  images?: ProductImageRow[];
};

async function currentImages(productId: string) {
  return (await getProductImagesSnapshot(productId)) ?? undefined;
}

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
): Promise<ImageActionResult & { url?: string | null }> {
  try {
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return { ok: false, error: "No file provided." };
    }

    const result = await uploadProductImage(productId, file, color);

    if (result.error || !result.data) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null, url: result.data.url, images: await currentImages(productId) };
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
): Promise<ImageActionResult> {
  try {
    const result = await removeProductImage(productId, color);

    if (result.error) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null, images: await currentImages(productId) };
  } catch (err) {
    console.error("[image-actions] removeProductImageAction: unexpected exception", {
      productId,
      imageType: color?.trim() ? "color" : "main",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: FRIENDLY_REMOVE_ERROR };
  }
}

/** Make an existing photo the product's listing cover. Same never-throws contract. */
export async function setProductCoverImageAction(
  productId: string,
  imageId: string,
): Promise<ImageActionResult> {
  try {
    const result = await setProductCoverImage(productId, imageId);

    if (result.error) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null, images: await currentImages(productId) };
  } catch (err) {
    console.error("[image-actions] setProductCoverImageAction: unexpected exception", {
      productId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: FRIENDLY_COVER_ERROR };
  }
}
