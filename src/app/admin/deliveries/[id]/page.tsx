import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Printer, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryForm } from "@/components/deliveries/delivery-form";
import { DeliveryStatusBadge } from "@/components/deliveries/delivery-status-badge";
import { PaymentStatusBadge } from "@/components/orders/status-badge";
import { getDelivery } from "@/lib/services/delivery.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate, formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type DeliveryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  const { id } = await params;
  const delivery = await getDelivery(id);

  if (!delivery) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Delivery</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{delivery.order.order_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Created {formatDateTime(delivery.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/orders/${delivery.order_id}`}>
              <FileText aria-hidden className="mr-2 h-4 w-4" />
              Order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/print/label/${delivery.order_id}`}>
              <Tags aria-hidden className="mr-2 h-4 w-4" />
              Label
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/print/combined/${delivery.order_id}`}>
              <Printer aria-hidden className="mr-2 h-4 w-4" />
              Combined print
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Delivery status</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryStatusBadge status={delivery.delivery_status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Delivery date</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-musiva-plum">
            {delivery.delivery_date ? formatDate(delivery.delivery_date) : "-"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentStatusBadge status={delivery.order.payment_status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Amount to collect</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-musiva-plum">
            {formatBhd(delivery.order.amount_due)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Delivery summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <Info label="Customer" value={delivery.customer_name} />
          <Info label="Phone" value={delivery.phone} />
          <Info label="Governorate" value={delivery.governorate} />
          <Info label="Area" value={delivery.area} />
          <Info label="Block" value={delivery.block} />
          <Info label="Road" value={delivery.road} />
          <Info label="Building" value={delivery.building} />
          <Info label="Flat" value={delivery.flat} />
          <Info label="Landmark" value={delivery.landmark} />
          <Info label="Time slot" value={delivery.delivery_time_slot} />
          <Info label="Courier" value={delivery.courier_name} />
          <Info label="Courier phone" value={delivery.courier_phone} />
          <Info label="Order source" value={titleize(delivery.order.order_source)} />
          <Info label="Delivery notes" value={delivery.delivery_note} />
        </CardContent>
      </Card>

      <DeliveryForm delivery={delivery} />
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
