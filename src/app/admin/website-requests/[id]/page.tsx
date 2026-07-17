import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebsiteRequestStatusBadge } from "@/components/website-requests/website-request-status-badge";
import { WebsiteRequestStatusActions } from "@/components/website-requests/website-request-status-actions";
import { getAllowedNextStatuses, getWebsiteRequest } from "@/lib/services/website-request.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS } from "@/lib/constants/statuses";

type WebsiteRequestDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WebsiteRequestDetailPage({ params }: WebsiteRequestDetailPageProps) {
  const { id } = await params;
  const [request, { profile }] = await Promise.all([getWebsiteRequest(id), getCurrentAuthState()]);

  if (!request) {
    notFound();
  }

  const role = profile?.role;
  const allowedNextStatuses = getAllowedNextStatuses(request.status, role);
  const paymentLabel =
    WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS[request.payment_preference] ?? request.payment_preference;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/website-requests"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Website Requests
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{request.request_number}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Website requests are pending WhatsApp leads. Confirming here does not create an order or
          deduct stock.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Name" value={request.customer_name} />
              <Info label="Mobile" value={request.mobile_display} />
              <Info label="WhatsApp" value={request.whatsapp_display} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Product" value={request.product_name_snapshot} />
              <Info label="Color" value={request.color_snapshot} />
              <Info label="Size" value={request.size_snapshot} />
              <Info label="Quantity" value={String(request.quantity)} />
              <Info label="Unit price" value={formatBhd(request.unit_price_snapshot)} />
              <Info label="Total" value={formatBhd(request.total_snapshot)} />
              <Info label="Payment preference" value={paymentLabel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Governorate" value={request.governorate} />
              <Info label="Area" value={request.area} />
              <Info label="Block" value={request.block} />
              <Info label="Road" value={request.road} />
              <Info label="Building" value={request.building} />
              <Info label="Flat" value={request.flat} />
              <Info label="Landmark" value={request.landmark} />
              <Info label="Delivery notes" value={request.delivery_notes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap rounded-md bg-musiva-ivory p-4 text-sm leading-6 text-foreground">
                {request.whatsapp_message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This is the message the customer prepared to send at checkout. Use the &ldquo;Open
                WhatsApp&rdquo; button to send a staff follow-up instead.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Side panel — status + actions ───────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <WebsiteRequestStatusBadge status={request.status} />

              <WebsiteRequestStatusActions
                requestId={request.id}
                customerName={request.customer_name}
                requestNumber={request.request_number}
                whatsappNormalized={request.whatsapp_normalized}
                status={request.status}
                allowedNextStatuses={allowedNextStatuses}
                role={role}
              />

              <div className="space-y-1 border-t border-[hsl(var(--border))] pt-3 text-xs text-muted-foreground">
                <p>Created {formatDateTime(request.created_at)}</p>
                <p>Updated {formatDateTime(request.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-medium text-musiva-plum">{label}</p>
      <p className="mt-1 text-muted-foreground">{value ?? "-"}</p>
    </div>
  );
}
