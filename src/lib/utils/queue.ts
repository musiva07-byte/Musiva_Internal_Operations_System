import { format, isToday, isYesterday, parseISO } from "date-fns";
import type { DeliveryListItem, OrderListItem } from "@/types/app";

export type { OrderTabCounts, DeliveryTabCounts } from "@/types/app";

// ─── Date grouping ────────────────────────────────────────────────────────────

export type DateGroup<T> = {
  label: string;
  dateKey: string;
  items: T[];
};

/**
 * Groups items by calendar date (newest group first, items within group in
 * the order they arrive — caller is responsible for pre-sorting).
 */
export function groupByDate<T extends { created_at: string }>(items: T[]): DateGroup<T>[] {
  const groups = new Map<string, { label: string; dateKey: string; items: T[] }>();

  for (const item of items) {
    const date = parseISO(item.created_at);
    const dateKey = format(date, "yyyy-MM-dd");

    let label: string;
    if (isToday(date)) {
      label = `Today — ${format(date, "d MMMM yyyy")}`;
    } else if (isYesterday(date)) {
      label = `Yesterday — ${format(date, "d MMMM yyyy")}`;
    } else {
      label = format(date, "d MMMM yyyy");
    }

    if (!groups.has(dateKey)) {
      groups.set(dateKey, { label, dateKey, items: [] });
    }
    groups.get(dateKey)!.items.push(item);
  }

  // Newest date first
  return Array.from(groups.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

// ─── Needs Attention — Orders ─────────────────────────────────────────────────

export type OrderAttentionReason =
  | "unpaid_ready"
  | "cod_amount_due"
  | "missing_mobile";

export function needsAttentionOrder(order: OrderListItem): OrderAttentionReason | null {
  if (!order.customer_mobile) return "missing_mobile";

  if (
    (order.order_status === "in_fulfilment" ||
      // Legacy statuses
      order.order_status === "ready_for_pickup" ||
      order.order_status === "out_for_delivery") &&
    order.payment_status === "unpaid"
  ) {
    return "unpaid_ready";
  }

  if (
    (order.order_status === "completed" || order.order_status === "delivered") &&
    order.payment_status === "cod" &&
    Number(order.amount_due) > 0
  ) {
    return "cod_amount_due";
  }

  return null;
}

export const ORDER_ATTENTION_LABELS: Record<OrderAttentionReason, string> = {
  unpaid_ready: "Unpaid — ready for fulfilment",
  cod_amount_due: "COD amount still due",
  missing_mobile: "Missing customer mobile",
};

// ─── Needs Attention — Deliveries ─────────────────────────────────────────────

export type DeliveryAttentionReason =
  | "failed"
  | "missing_address"
  | "missing_phone"
  | "cod_uncollected";

export function needsAttentionDelivery(delivery: DeliveryListItem): DeliveryAttentionReason | null {
  if (!delivery.phone) return "missing_phone";
  if (!delivery.area && !delivery.governorate) return "missing_address";
  if (delivery.delivery_status === "failed" || delivery.delivery_status === "returned_to_store") {
    return "failed";
  }
  if (
    delivery.delivery_status === "delivered" &&
    delivery.payment_status === "cod" &&
    !delivery.cod_collected &&
    Number(delivery.amount_due) > 0
  ) {
    return "cod_uncollected";
  }
  return null;
}

export const DELIVERY_ATTENTION_LABELS: Record<DeliveryAttentionReason, string> = {
  failed: "Delivery failed",
  missing_address: "Missing delivery address",
  missing_phone: "Missing customer phone",
  cod_uncollected: "COD not collected",
};

// ─── Summary computation ──────────────────────────────────────────────────────

export function computeOrderSummary(orders: OrderListItem[]): {
  count: number;
  total: number;
  attentionCount: number;
} {
  return {
    count: orders.length,
    total: orders.reduce((sum, o) => sum + Number(o.grand_total), 0),
    attentionCount: orders.filter((o) => needsAttentionOrder(o) !== null).length,
  };
}

export function computeDeliverySummary(deliveries: DeliveryListItem[]): {
  pending: number;
  outForDelivery: number;
  attentionCount: number;
} {
  return {
    pending: deliveries.filter((d) => d.delivery_status === "pending").length,
    outForDelivery: deliveries.filter((d) => d.delivery_status === "out_for_delivery").length,
    attentionCount: deliveries.filter((d) => needsAttentionDelivery(d) !== null).length,
  };
}

// ─── Allowed bulk order actions ───────────────────────────────────────────────

/**
 * Bulk actions that are safe to apply to multiple orders without individual
 * confirmation. Delivered / Cancelled / Returned must be done per-order.
 */
export const SAFE_BULK_ORDER_ACTIONS = ["confirm"] as const;
export type BulkOrderAction = (typeof SAFE_BULK_ORDER_ACTIONS)[number];

export const SAFE_BULK_DELIVERY_ACTIONS = ["packed", "ready_for_pickup"] as const;
export type BulkDeliveryAction = (typeof SAFE_BULK_DELIVERY_ACTIONS)[number];
