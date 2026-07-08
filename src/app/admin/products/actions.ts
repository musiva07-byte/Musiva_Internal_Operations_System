"use server";

import {
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  canDeleteProduct,
  permanentDeleteProduct,
} from "@/lib/services/product.service";
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

export async function archiveProductAction(productId: string) {
  const result = await archiveProduct(productId);
  return { ok: !result.error, error: result.error };
}

export async function restoreProductAction(
  productId: string,
  targetStatus: "active" | "inactive" = "active",
) {
  const result = await restoreProduct(productId, targetStatus);
  return { ok: !result.error, error: result.error };
}

/** Check whether a product is safe to permanently delete. No auth required. */
export async function checkProductDeletableAction(productId: string) {
  const result = await canDeleteProduct(productId);
  return result;
}

export async function deleteProductAction(productId: string) {
  const result = await permanentDeleteProduct(productId);
  return { ok: !result.error, error: result.error };
}
