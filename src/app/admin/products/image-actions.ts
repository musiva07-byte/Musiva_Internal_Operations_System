"use server";

import { uploadProductImage, removeProductImage } from "@/lib/services/product-image.service";

/**
 * Upload or replace the product image.
 * Expects FormData with a "file" field containing the image File.
 */
export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string | null; url?: string | null }> {
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }

  const result = await uploadProductImage(productId, file);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null, url: result.data.url };
}

/**
 * Remove the product image entirely.
 */
export async function removeProductImageAction(
  productId: string,
): Promise<{ ok: boolean; error?: string | null }> {
  const result = await removeProductImage(productId);

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}
