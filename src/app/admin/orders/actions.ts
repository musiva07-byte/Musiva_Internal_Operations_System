"use server";

import {
  createOrder,
  updateOrder,
  cancelOrder,
  transitionOrderStatus,
  confirmOrderHandoff,
  bulkOrderAction,
} from "@/lib/services/order.service";
import type { CreateOrderInput, UpdateOrderInput } from "@/lib/validations/order.schema";
import type { OrderStatus } from "@/types/database";

/** Snapshot returned to the client on successful order creation. */
export type OrderCreatedSnapshot = {
  ok: true;
  error: null;
  id: string;
  orderNumber: string;
  grandTotal: number;
  paymentStatus: string;
  fulfilmentMethod: string;
};

export type CreateOrderActionResult =
  | { ok: false; error: string | null | undefined; id: null }
  | OrderCreatedSnapshot;

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<CreateOrderActionResult> {
  const result = await createOrder(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  const order = result.data;
  return {
    ok: true,
    error: null,
    id: order.id,
    orderNumber: order.order_number,
    grandTotal: order.grand_total,
    paymentStatus: order.payment_status,
    fulfilmentMethod: order.fulfilment_method,
  };
}

export async function updateOrderAction(orderId: string, input: UpdateOrderInput) {
  const result = await updateOrder(orderId, input);
  if (result.error || !result.data) return { ok: false, error: result.error, id: null };
  return { ok: true, error: null, id: result.data.id };
}

export async function cancelOrderAction(orderId: string) {
  const result = await cancelOrder(orderId);
  if (result.error || !result.data) return { ok: false, error: result.error };
  return { ok: true, error: null };
}

export async function transitionOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
) {
  const result = await transitionOrderStatus(orderId, newStatus, reason);
  if (result.error || !result.data) return { ok: false, error: result.error };
  return { ok: true, error: null };
}

/**
 * Confirm a delivery order — creates the delivery record (idempotent)
 * and moves the order to in_fulfilment in one step.
 */
export async function confirmOrderHandoffAction(orderId: string) {
  const result = await confirmOrderHandoff(orderId);
  if (result.error || !result.data) return { ok: false, error: result.error };
  return { ok: true, error: null };
}

/**
 * Bulk confirm: routes each order to the correct path
 * (delivery orders → confirmOrderHandoff, walk-in → transitionOrderStatus).
 */
export async function bulkOrderActionAction(
  orderIds: string[],
  action: "confirm",
) {
  return bulkOrderAction(orderIds, action);
}
