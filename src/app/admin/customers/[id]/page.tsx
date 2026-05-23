import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badge";
import { getCustomer } from "@/lib/services/customer.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) {
    notFound();
  }

  const totalSpending = customer.orders.reduce((sum, order) => sum + Number(order.grand_total), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Customer</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{customer.full_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{customer.mobile}</p>
        </div>
        <Button asChild>
          <Link href={`/admin/customers/${customer.id}/edit`}>
            <Edit aria-hidden className="mr-2 h-4 w-4" />
            Edit customer
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Orders</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-musiva-plum">{customer.orders.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total spending</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-musiva-plum">{formatBhd(totalSpending)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Governorate</CardTitle></CardHeader>
          <CardContent>{customer.governorate ?? "-"}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Address details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <Info label="Area" value={customer.area} />
          <Info label="Block" value={customer.block} />
          <Info label="Road" value={customer.road} />
          <Info label="Building" value={customer.building} />
          <Info label="Flat" value={customer.flat} />
          <Info label="Landmark" value={customer.landmark} />
          <Info label="Delivery notes" value={customer.delivery_notes} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customer.orders.length === 0 ? (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>No orders yet.</TableCell>
              </TableRow>
            ) : (
              customer.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/orders/${order.id}`}>
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                  <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                  <TableCell className="text-right">{formatBhd(order.grand_total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
