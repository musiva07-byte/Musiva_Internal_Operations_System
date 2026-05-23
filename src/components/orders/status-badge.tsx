import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import type { OrderStatus, PaymentStatus } from "@/types/database";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === "delivered") {
    return <Badge variant="success">{titleize(status)}</Badge>;
  }

  if (status === "cancelled" || status === "returned") {
    return <Badge variant="danger">{titleize(status)}</Badge>;
  }

  if (status === "new" || status === "confirmed" || status === "packed") {
    return <Badge variant="warning">{titleize(status)}</Badge>;
  }

  return <Badge variant="secondary">{titleize(status)}</Badge>;
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
