"use server";

import { createCustomer, updateCustomer } from "@/lib/services/customer.service";
import type { CustomerInput } from "@/lib/validations/customer.schema";

export async function createCustomerAction(input: CustomerInput) {
  const result = await createCustomer(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function updateCustomerAction(customerId: string, input: CustomerInput) {
  const result = await updateCustomer(customerId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
