import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "@/lib/constants";
import { listPurchases } from "@/lib/services/purchase.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import type { PurchasePaymentStatus, PurchaseStatus } from "@/types/database";

type PurchasesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const status = getParam(params, "status") ?? "all";
  const paymentStatus = getParam(params, "paymentStatus") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const purchases = await listPurchases({ q, status, paymentStatus, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (paymentStatus !== "all") next.set("paymentStatus", paymentStatus);
    next.set("page", String(nextPage));
    return `/admin/purchases?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Purchases</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Purchase orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track supplier stock orders, arrival status, received units, and payment status.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/purchases/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New purchase
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_210px_190px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search purchase or supplier" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="all">All statuses</option>
              {Object.values(PURCHASE_STATUSES).map((purchaseStatus) => (
                <option key={purchaseStatus} value={purchaseStatus}>
                  {titleize(purchaseStatus)}
                </option>
              ))}
            </Select>
            <Select defaultValue={paymentStatus} name="paymentStatus">
              <option value="all">All payments</option>
              {Object.values(PURCHASE_PAYMENT_STATUSES).map((purchasePaymentStatus) => (
                <option key={purchasePaymentStatus} value={purchasePaymentStatus}>
                  {titleize(purchasePaymentStatus)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                  No purchase orders found.
                </TableCell>
              </TableRow>
            ) : (
              purchases.data.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/purchases/${purchase.id}`}>
                      {purchase.purchase_number}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(purchase.purchase_date)}</p>
                  </TableCell>
                  <TableCell>{purchase.supplier_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(purchase.status)}>{titleize(purchase.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentVariant(purchase.payment_status)}>
                      {titleize(purchase.payment_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{purchase.item_count}</TableCell>
                  <TableCell>{purchase.received_units}</TableCell>
                  <TableCell className="text-right">{formatBhd(purchase.grand_total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={purchases.page} pageCount={purchases.pageCount} />
    </div>
  );
}
