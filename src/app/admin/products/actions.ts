"use server";

import { createProduct, updateProduct } from "@/lib/services/product.service";
import type { ProductInput } from "@/lib/validations/product.schema";

export async function createProductAction(input: ProductInput) {
  const result = await createProduct(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function updateProductAction(productId: string, input: ProductInput) {
  const result = await updateProduct(productId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
