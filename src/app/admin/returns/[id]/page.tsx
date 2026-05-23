import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReturnStatusBadge } from "@/components/returns/return-status-badge";
import { getReturn } from "@/lib/services/return.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type ReturnDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReturnDetailPage({ params }: ReturnDetailPageProps) {
  const { id } = await params;
  const returnRecord = await getReturn(id);

  if (!returnRecord) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Return</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{returnRecord.order.order_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(returnRecord.created_at)}</p>
        </div>
        <Button asChild>
          <Link href={`/admin/orders/${returnRecord.original_order_id}`}>
            <FileText aria-hidden className="mr-2 h-4 w-4" />
            Original order
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ReturnStatusBadge status={returnRecord.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Type</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-musiva-plum">{titleize(returnRecord.return_type)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Condition</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-musiva-plum">{titleize(returnRecord.condition)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Refund</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-musiva-plum">{formatBhd(returnRecord.refund_amount)}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Customer and reason</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <Info label="Customer" value={returnRecord.customer.full_name} />
          <Info label="Mobile" value={returnRecord.customer.mobile} />
          <Info label="Reason" value={titleize(returnRecord.reason)} />
          <Info label="Notes" value={returnRecord.notes} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Returned items</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returnRecord.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product_name_snapshot}</TableCell>
                <TableCell>
                  {item.color_snapshot} / {item.size_snapshot}
                  <p className="mt-1 text-xs text-muted-foreground">{item.variant_sku_snapshot}</p>
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{titleize(item.action)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {returnRecord.return_type === "exchange" ? (
        <Card>
          <CardHeader>
            <CardTitle>Exchange placeholder</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Replacement order linking will be completed in the full exchange workflow. Existing returned-item stock
            actions have already been recorded.
          </CardContent>
        </Card>
      ) : null}
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
