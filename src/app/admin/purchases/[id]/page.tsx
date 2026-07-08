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
import { getCurrentStaffProfile } from "@/lib/auth/session";
import { canViewCostData } from "@/lib/auth/permissions";
import { formatBhd, formatExchangeRate, formatSupplierCurrency } from "@/lib/formatters/currency";
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
  if (status === PURCHASE_STATUSES.inTransit) return "secondary";
  return "secondary";
}

function paymentVariant(status: PurchasePaymentStatus) {
  if (status === PURCHASE_PAYMENT_STATUSES.paid) return "success";
  if (status === PURCHASE_PAYMENT_STATUSES.partial) return "warning";
  return "danger";
}

export default async function PurchasePage({ params }: PurchasePageProps) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  const purchase = await getPurchase(id);

  if (!purchase) {
    notFound();
  }

  const showCost = canViewCostData(profile?.role);
  const canReceive =
    purchase.status !== PURCHASE_STATUSES.received &&
    purchase.status !== PURCHASE_STATUSES.cancelled;
  const totalReceived = purchase.items.reduce((sum, item) => sum + item.quantity_received, 0);

  const hasExchangeRate =
    purchase.purchase_currency !== "BHD" &&
    purchase.purchase_currency &&
    purchase.exchange_rate_to_bhd !== null;

  const totalImportCosts =
    purchase.customs_cost_bhd +
    purchase.bank_fee_bhd +
    purchase.packaging_cost_bhd +
    purchase.other_import_cost_bhd;

  // Number of cost columns appended to items table (role-gated)
  const costColCount = showCost ? 4 : 0;
  const totalItemCols = 4 + costColCount;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Purchases</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{purchase.purchase_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Supplier:{" "}
            <Link
              className="text-musiva-plum hover:underline"
              href={`/admin/suppliers/${purchase.supplier.id}`}
            >
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

      {/* Status cards */}
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
            <Badge variant={paymentVariant(purchase.payment_status)}>
              {titleize(purchase.payment_status)}
            </Badge>
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

      {/* Exchange rate section (only if purchase was in a foreign currency) */}
      {hasExchangeRate && showCost ? (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Exchange rate</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Purchase currency</p>
              <p className="mt-1 font-medium text-musiva-plum">{purchase.purchase_currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rate used</p>
              <p className="mt-1 font-medium text-musiva-plum">
                {formatExchangeRate(purchase.exchange_rate_to_bhd, purchase.purchase_currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Rate date</p>
              <p className="mt-1 font-medium text-musiva-plum">
                {purchase.exchange_rate_date ? formatDate(purchase.exchange_rate_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="mt-1 font-medium text-musiva-plum capitalize">
                {purchase.exchange_rate_source ?? "Manual"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                This rate is a historical snapshot recorded at purchase creation. It cannot be changed
                after the purchase is received.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Items table */}
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
              {showCost ? (
                <>
                  <TableHead className="text-right">Supplier cost</TableHead>
                  <TableHead className="text-right">Converted BHD</TableHead>
                  <TableHead className="text-right">Alloc. import</TableHead>
                  <TableHead className="text-right">Landed cost</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.items.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-20 text-center text-muted-foreground"
                  colSpan={totalItemCols}
                >
                  No items on this purchase order.
                </TableCell>
              </TableRow>
            ) : (
              purchase.items.map((item) => (
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
                  {showCost ? (
                    <>
                      <TableCell className="text-right">
                        {item.supplier_unit_cost !== null && item.supplier_currency ? (
                          <span>
                            {formatSupplierCurrency(item.supplier_unit_cost, item.supplier_currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.converted_unit_cost_bhd !== null
                          ? formatBhd(item.converted_unit_cost_bhd)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBhd(item.allocated_import_cost_bhd)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-musiva-plum">
                        {item.landed_unit_cost_bhd !== null
                          ? formatBhd(item.landed_unit_cost_bhd)
                          : formatBhd(item.cost_price)}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))
            )}
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
              <span className="text-muted-foreground">Subtotal (converted)</span>
              <span>{formatBhd(purchase.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>- {formatBhd(purchase.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatBhd(purchase.shipping_cost)}</span>
            </div>
            {showCost && totalImportCosts > 0 ? (
              <>
                {purchase.customs_cost_bhd > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customs</span>
                    <span>{formatBhd(purchase.customs_cost_bhd)}</span>
                  </div>
                ) : null}
                {purchase.bank_fee_bhd > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank fee</span>
                    <span>{formatBhd(purchase.bank_fee_bhd)}</span>
                  </div>
                ) : null}
                {purchase.packaging_cost_bhd > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Packaging</span>
                    <span>{formatBhd(purchase.packaging_cost_bhd)}</span>
                  </div>
                ) : null}
                {purchase.other_import_cost_bhd > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other import costs</span>
                    <span>{formatBhd(purchase.other_import_cost_bhd)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
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
