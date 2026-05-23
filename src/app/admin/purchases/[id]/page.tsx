import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { receivePurchaseFormAction } from "@/app/admin/purchases/actions";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "@/lib/constants";
import { getPurchase } from "@/lib/services/purchase.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import type { PurchasePaymentStatus, PurchaseStatus } from "@/types/database";

type PurchasePageProps = {
  params: Promise<{ id: string }>;
};

function statusVariant(status: PurchaseStatus) {
  if (status === PURCHASE_STATUSES.received) return "success";
  if (status === PURCHASE_STATUSES.cancelled) return "danger";
  if (status === PURCHASE_STATUSES.partiallyReceived) return "warning";
  return "secondary";
}

function paymentVariant(status: PurchasePaymentStatus) {
  if (status === PURCHASE_PAYMENT_STATUSES.paid) return "success";
  if (status === PURCHASE_PAYMENT_STATUSES.partial) return "warning";
  return "danger";
}

export default async function PurchasePage({ params }: PurchasePageProps) {
  const { id } = await params;
  const purchase = await getPurchase(id);

  if (!purchase) {
    notFound();
  }

  const canReceive = purchase.status !== PURCHASE_STATUSES.received && purchase.status !== PURCHASE_STATUSES.cancelled;
  const totalReceived = purchase.items.reduce((sum, item) => sum + item.quantity_received, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Purchases</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{purchase.purchase_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Supplier:{" "}
            <Link className="text-musiva-plum hover:underline" href={`/admin/suppliers/${purchase.supplier.id}`}>
              {purchase.supplier.supplier_name}
            </Link>
          </p>
        </div>
        {canReceive ? (
          <form action={receivePurchaseFormAction.bind(null, purchase.id)}>
            <Button type="submit">
              <CheckCircle2 aria-hidden className="mr-2 h-4 w-4" />
              Mark received
            </Button>
          </form>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusVariant(purchase.status)}>{titleize(purchase.status)}</Badge>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={paymentVariant(purchase.payment_status)}>{titleize(purchase.payment_status)}</Badge>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Purchase date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-musiva-plum">{formatDate(purchase.purchase_date)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Received units</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-musiva-plum">{totalReceived}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium text-musiva-plum">{item.product_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.variant_sku}</p>
                </TableCell>
                <TableCell>
                  {item.color} / {item.size}
                </TableCell>
                <TableCell>{item.quantity_ordered}</TableCell>
                <TableCell>{item.quantity_received}</TableCell>
                <TableCell className="text-right">{formatBhd(item.cost_price)}</TableCell>
                <TableCell className="text-right">{formatBhd(item.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {purchase.notes || "No notes saved."}
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatBhd(purchase.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>{formatBhd(purchase.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatBhd(purchase.shipping_cost)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold text-musiva-plum">
              <span>Grand total</span>
              <span>{formatBhd(purchase.grand_total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
