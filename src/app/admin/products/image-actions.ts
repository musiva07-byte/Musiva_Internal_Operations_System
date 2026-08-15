"use server";

import { uploadProductImage, removeProductImage } from "@/lib/services/product-image.service";

/**
 * Upload or replace a product image. Expects FormData with a "file" field containing the
 * image File. Pass `color` to manage that color's image instead of the main image.
 */
export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
  color?: string | null,
): Promise<{ ok: boolean; error?: string | null; url?: string | null }> {
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }

  const result = await uploadProductImage(productId, file, color);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null, url: result.data.url };
}

/**
 * Remove a product image. Pass `color` to remove that color's image instead of the main
 * image.
 */
export async function removeProductImageAction(
  productId: string,
  color?: string | null,
): Promise<{ ok: boolean; error?: string | null }> {
  const result = await removeProductImage(productId, color);

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}
