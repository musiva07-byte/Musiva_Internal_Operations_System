import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, FileText, Printer, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badge";
import { getOrder } from "@/lib/services/order.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Order</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{order.order_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/print/invoice/${order.id}`}>
              <FileText aria-hidden className="mr-2 h-4 w-4" />
              Invoice
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/print/label/${order.id}`}>
              <Tags aria-hidden className="mr-2 h-4 w-4" />
              Label
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/print/combined/${order.id}`}>
              <Printer aria-hidden className="mr-2 h-4 w-4" />
              Combined
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/orders/${order.id}/edit`}>
              <Edit aria-hidden className="mr-2 h-4 w-4" />
              Edit order
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Order status</CardTitle></CardHeader><CardContent><OrderStatusBadge status={order.order_status} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Payment</CardTitle></CardHeader><CardContent><PaymentStatusBadge status={order.payment_status} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Grand total</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-musiva-plum">{formatBhd(order.grand_total)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Amount due</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-musiva-plum">{formatBhd(order.amount_due)}</CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Customer and delivery</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <Info label="Customer" value={order.customer.full_name} />
          <Info label="Mobile" value={order.customer.mobile} />
          <Info label="Governorate" value={order.customer.governorate} />
          <Info label="Area" value={order.customer.area} />
          <Info label="Block" value={order.customer.block} />
          <Info label="Road" value={order.customer.road} />
          <Info label="Building" value={order.customer.building} />
          <Info label="Flat" value={order.customer.flat} />
          <Info label="Delivery notes" value={order.customer.delivery_notes} />
          <Info label="Delivery status" value={order.delivery?.delivery_status ? titleize(order.delivery.delivery_status) : "No delivery"} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product snapshot</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product_name_snapshot}</TableCell>
                <TableCell>{item.color_snapshot} / {item.size_snapshot}<p className="text-xs text-muted-foreground">{item.variant_sku_snapshot}</p></TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatBhd(item.unit_price)}</TableCell>
                <TableCell>{formatBhd(item.discount)}</TableCell>
                <TableCell className="text-right">{formatBhd(item.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-5">
          <Info label="Subtotal" value={formatBhd(order.subtotal)} />
          <Info label="Discount" value={formatBhd(order.discount_total)} />
          <Info label="Delivery" value={formatBhd(order.delivery_charge)} />
          <Info label="Paid" value={formatBhd(order.amount_paid)} />
          <Info label="Due" value={formatBhd(order.amount_due)} />
        </CardContent>
      </Card>
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
