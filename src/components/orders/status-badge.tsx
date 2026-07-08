import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import type { OrderStatus, PaymentStatus } from "@/types/database";

const ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  in_fulfilment: "In Fulfilment",
  exchange_requested: "Exchange requested",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABELS[status] ?? titleize(status);

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
