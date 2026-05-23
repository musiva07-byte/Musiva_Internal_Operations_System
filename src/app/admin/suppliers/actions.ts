"use server";

import { createSupplier, updateSupplier } from "@/lib/services/supplier.service";
import type { SupplierInput } from "@/lib/validations/supplier.schema";

export async function createSupplierAction(input: SupplierInput) {
  const result = await createSupplier(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function updateSupplierAction(supplierId: string, input: SupplierInput) {
  const result = await updateSupplier(supplierId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
