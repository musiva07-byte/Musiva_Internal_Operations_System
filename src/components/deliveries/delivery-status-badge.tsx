import { Badge } from "@/components/ui/badge";
import { titleize } from "@/lib/formatters/labels";
import type { DeliveryStatus } from "@/types/database";

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  if (status === "delivered") {
    return <Badge variant="success">{titleize(status)}</Badge>;
  }

  if (status === "failed" || status === "returned") {
    return <Badge variant="danger">{titleize(status)}</Badge>;
  }

  if (status === "pending" || status === "packed" || status === "ready_for_pickup") {
    return <Badge variant="warning">{titleize(status)}</Badge>;
  }

  return <Badge variant="secondary">{titleize(status)}</Badge>;
}
