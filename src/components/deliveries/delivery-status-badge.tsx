import { Badge } from "@/components/ui/badge";
import { titleize } from "@/lib/formatters/labels";
import type { DeliveryStatus } from "@/types/database";

const DELIVERY_STATUS_LABELS: Partial<Record<DeliveryStatus, string>> = {
  ready_for_pickup: "Ready",
  with_courier:     "With courier",
  out_for_delivery: "Out for delivery",
  returned_to_store: "Returned to store",
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const label = DELIVERY_STATUS_LABELS[status] ?? titleize(status);

  if (status === "delivered") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (status === "failed" || status === "returned_to_store" || status === "returned" || status === "cancelled") {
    return <Badge variant="danger">{label}</Badge>;
  }

  if (status === "pending" || status === "packed") {
    return <Badge variant="warning">{label}</Badge>;
  }

  if (status === "out_for_delivery") {
    return <Badge variant="secondary">{label}</Badge>;
  }

  return <Badge variant="secondary">{label}</Badge>;
}
