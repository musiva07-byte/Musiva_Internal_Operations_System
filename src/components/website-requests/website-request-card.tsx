"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebsiteRequestStatusBadge } from "@/components/website-requests/website-request-status-badge";
import { WebsiteRequestStatusActions } from "@/components/website-requests/website-request-status-actions";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS } from "@/lib/constants/statuses";
import type { StaffRole } from "@/lib/constants";
import type { WebsiteRequestListItem } from "@/types/app";

type Props = {
  request: WebsiteRequestListItem;
  role: StaffRole | null | undefined;
};

export function WebsiteRequestCard({ request, role }: Props) {
  const router = useRouter();
  const detailHref = `/admin/website-requests/${request.id}`;

  return (
    <Card className="shadow-soft">
      <div className="space-y-4 p-4">
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="font-semibold text-musiva-plum hover:underline"
            onClick={() => router.push(detailHref)}
          >
            {request.request_number}
          </button>
          <div className="flex items-center gap-2">
            <WebsiteRequestStatusBadge status={request.status} />
            <span className="text-xs text-muted-foreground">
              {formatDateTime(request.created_at)}
            </span>
          </div>
        </div>

        {/* Customer + product */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </p>
            <p className="mt-1 font-medium text-foreground">{request.customer_name}</p>
            <p className="text-sm text-muted-foreground">{request.mobile_display}</p>
            {request.whatsapp_display !== request.mobile_display && (
              <p className="text-xs text-muted-foreground">WA: {request.whatsapp_display}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Product
            </p>
            <p className="mt-1 font-medium text-foreground">{request.product_name_snapshot}</p>
            <p className="text-sm text-muted-foreground">
              {[request.color_snapshot, request.size_snapshot].filter(Boolean).join(" / ") || "—"}
              {" · "}
              Qty {request.quantity}
              {" · "}
              {formatBhd(request.total_snapshot)}
            </p>
            <p className="text-xs text-muted-foreground">
              {WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS[request.payment_preference] ??
                request.payment_preference}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-[hsl(var(--border))] pt-3">
          <WebsiteRequestStatusActions
            requestId={request.id}
            customerName={request.customer_name}
            requestNumber={request.request_number}
            whatsappNormalized={request.whatsapp_normalized}
            status={request.status}
            allowedNextStatuses={request.allowedNextStatuses}
            role={role}
            size="sm"
          />
          <Button size="sm" variant="ghost" onClick={() => router.push(detailHref)}>
            View details
          </Button>
        </div>
      </div>
    </Card>
  );
}
