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

  const allowedNextStatuses = getAllowedNextStatuses(request.status, profile?.role);
  const paymentLabel =
    WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS[request.payment_preference] ?? request.payment_preference;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link
            href="/admin/website-requests"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
            Website Requests
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{request.request_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Created {formatDateTime(request.created_at)}
          </p>
        </div>
        <WebsiteRequestStatusBadge status={request.status} />
      </header>

      <WebsiteRequestStatusActions
        requestId={request.id}
        customerName={request.customer_name}
        requestNumber={request.request_number}
        whatsappNormalized={request.whatsapp_normalized}
        allowedNextStatuses={allowedNextStatuses}
      />

      <section className="grid gap-4 md:grid-cols-2">
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
            <CardTitle>Product</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label="Product" value={request.product_name_snapshot} />
            <Info label="Color" value={request.color_snapshot} />
            <Info label="Size" value={request.size_snapshot} />
            <Info label="Quantity" value={String(request.quantity)} />
            <Info label="Unit price" value={formatBhd(request.unit_price_snapshot)} />
            <Info label="Total" value={formatBhd(request.total_snapshot)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
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
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label="Payment preference" value={paymentLabel} />
          </CardContent>
        </Card>
      </section>

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
            WhatsApp&rdquo; button above to send a staff follow-up instead.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <Info label="Status" value={request.status} />
          <Info label="Created" value={formatDateTime(request.created_at)} />
          <Info label="Updated" value={formatDateTime(request.updated_at)} />
        </CardContent>
      </Card>

      <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-sm text-muted-foreground">
        Convert to Order — coming in a later unit. Confirming a request here does not create an
        order or deduct stock; staff still place the sale through New Sale once availability and
        payment are confirmed.
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
