"use server";

import { createOrder, updateOrder } from "@/lib/services/order.service";
import type { CreateOrderInput, UpdateOrderInput } from "@/lib/validations/order.schema";

export async function createOrderAction(input: CreateOrderInput) {
  const result = await createOrder(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}

export async function updateOrderAction(orderId: string, input: UpdateOrderInput) {
  const result = await updateOrder(orderId, input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
