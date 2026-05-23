import Link from "next/link";
import { CalendarDays, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { DeliveryStatusBadge } from "@/components/deliveries/delivery-status-badge";
import { PaymentStatusBadge } from "@/components/orders/status-badge";
import { listDeliveries } from "@/lib/services/delivery.service";
import { DELIVERY_STATUSES } from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import type { PaymentStatus } from "@/types/database";

type DeliveriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeliveriesPage({ searchParams }: DeliveriesPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const status = getParam(params, "status") ?? "all";
  const date = getParam(params, "date") ?? "";
  const page = Number(getParam(params, "page") ?? 1);
  const deliveries = await listDeliveries({ q, status, date, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (date) next.set("date", date);
    next.set("page", String(nextPage));
    return `/admin/deliveries?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Deliveries</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Delivery queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Filter delivery records by status, delivery date, order number, customer name, or phone.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_210px_180px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search order, name, phone" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="all">All statuses</option>
              {Object.values(DELIVERY_STATUSES).map((deliveryStatus) => (
                <option key={deliveryStatus} value={deliveryStatus}>
                  {titleize(deliveryStatus)}
                </option>
              ))}
            </Select>
            <div className="relative">
              <CalendarDays aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={date} name="date" type="date" />
            </div>
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
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                  No deliveries found.
                </TableCell>
              </TableRow>
            ) : (
              deliveries.data.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/deliveries/${delivery.id}`}>
                      {delivery.order_number}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBhd(delivery.grand_total)}</p>
                  </TableCell>
                  <TableCell>
                    <p>{delivery.customer_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{delivery.phone}</p>
                  </TableCell>
                  <TableCell>
                    <p>{delivery.area ?? "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{delivery.governorate ?? "-"}</p>
                  </TableCell>
                  <TableCell>{delivery.delivery_date ? formatDate(delivery.delivery_date) : "-"}</TableCell>
                  <TableCell>
                    <DeliveryStatusBadge status={delivery.delivery_status} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={delivery.payment_status as PaymentStatus} />
                    {delivery.amount_due > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">Collect {formatBhd(delivery.amount_due)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/print/label/${delivery.order_id}`}>
                        <Tags aria-hidden className="mr-2 h-4 w-4" />
                        Label
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={deliveries.page} pageCount={deliveries.pageCount} />
    </div>
  );
}
