import { Badge } from "@/components/ui/badge";
import { titleize } from "@/lib/formatters/labels";
import type { WebsiteOrderRequestStatus } from "@/types/database";

export function WebsiteRequestStatusBadge({ status }: { status: WebsiteOrderRequestStatus }) {
  const label = titleize(status);

  if (status === "confirmed") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (status === "cancelled") {
    return <Badge variant="danger">{label}</Badge>;
  }

  if (status === "contacted") {
    return <Badge variant="warning">{label}</Badge>;
  }

  return <Badge variant="secondary">{label}</Badge>; // "new"
}
