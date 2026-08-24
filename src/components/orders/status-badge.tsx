import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import type { OrderStatus, PaymentStatus } from "@/types/database";

// Staff-facing display labels only — the underlying order_status enum/DB values are unchanged
// (see types/database.ts OrderStatus and lib/constants/statuses.ts). "in_fulfilment" reads as
// "Preparing" everywhere staff see it; every other status transition/query keeps using the
// real "in_fulfilment" value internally.
const ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  in_fulfilment: "Preparing",
  exchange_requested: "Exchange requested",
};

/** Short "what does this status mean" text for the order detail status card. Kept intentionally
 *  brief — this is a hint, not documentation. */
const ORDER_STATUS_HELPER_TEXT: Partial<Record<OrderStatus, string>> = {
  new: "Waiting for confirmation",
  confirmed: "Confirmed and ready to prepare",
  in_fulfilment: "Being packed, picked up, or delivered",
  completed: "Finished order",
  delivered: "Finished order",
  cancelled: "Cancelled order",
  returned: "Returned order",
};

export function orderStatusHelperText(status: OrderStatus): string | null {
  return ORDER_STATUS_HELPER_TEXT[status] ?? null;
}

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? titleize(status);
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = orderStatusLabel(status);

  if (status === "completed" || status === "delivered") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (status === "cancelled") {
    return <Badge variant="danger">{label}</Badge>;
  }

  if (status === "returned" || status === "exchange_requested") {
    return <Badge variant="danger">{label}</Badge>;
  }

  if (status === "new" || status === "confirmed") {
    return <Badge variant="warning">{label}</Badge>;
  }

  if (status === "in_fulfilment") {
    return <Badge variant="secondary">{label}</Badge>;
  }

  // Legacy fulfilment statuses still in DB
  if (status === "packed" || status === "ready_for_pickup" || status === "out_for_delivery") {
    return <Badge variant="secondary">{label}</Badge>;
  }

  return <Badge variant="secondary">{label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === PAYMENT_STATUSES.paid) {
    return <Badge variant="success">{titleize(status)}</Badge>;
  }

  if (status === PAYMENT_STATUSES.unpaid) {
    return <Badge variant="danger">{titleize(status)}</Badge>;
  }

  if (status === PAYMENT_STATUSES.cod || status === PAYMENT_STATUSES.partial) {
    return <Badge variant="warning">{titleize(status)}</Badge>;
  }

  return <Badge variant="secondary">{titleize(status)}</Badge>;
}
