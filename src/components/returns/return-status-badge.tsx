import { Badge } from "@/components/ui/badge";
import { titleize } from "@/lib/formatters/labels";
import type { ReturnStatus } from "@/types/database";

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  if (status === "completed" || status === "approved") {
    return <Badge variant="success">{titleize(status)}</Badge>;
  }

  if (status === "cancelled") {
    return <Badge variant="danger">{titleize(status)}</Badge>;
  }

  return <Badge variant="warning">{titleize(status)}</Badge>;
}
