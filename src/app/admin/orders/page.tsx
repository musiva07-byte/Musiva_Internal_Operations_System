import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badge";
import { listOrders } from "@/lib/services/order.service";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const orderStatus = getParam(params, "orderStatus") ?? "all";
  const paymentStatus = getParam(params, "paymentStatus") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const orders = await listOrders({ q, orderStatus, paymentStatus, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (orderStatus !== "all") next.set("orderStatus", orderStatus);
    if (paymentStatus !== "all") next.set("paymentStatus", paymentStatus);
    next.set("page", String(nextPage));
    return `/admin/orders?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Orders</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Sales orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">Search by order number and filter by order/payment status.</p>
        </div>
        <Button asChild>
          <Link href="/admin/orders/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New order
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search MSV-10001" />
            </div>
            <Select defaultValue={orderStatus} name="orderStatus">
              <option value="all">All order statuses</option>
              {Object.values(ORDER_STATUSES).map((status) => (
                <option key={status} value={status}>{titleize(status)}</option>
              ))}
            </Select>
            <Select defaultValue={paymentStatus} name="paymentStatus">
              <option value="all">All payment statuses</option>
              {Object.values(PAYMENT_STATUSES).map((status) => (
                <option key={status} value={status}>{titleize(status)}</option>
              ))}
            </Select>
            <Button type="submit" variant="outline">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>No orders found.</TableCell>
              </TableRow>
            ) : (
              orders.data.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/orders/${order.id}`}>
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p>{order.customer_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{order.customer_mobile}</p>
                  </TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                  <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                  <TableCell>{order.item_count}</TableCell>
                  <TableCell className="text-right">{formatBhd(order.grand_total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={orders.page} pageCount={orders.pageCount} />
    </div>
  );
}
