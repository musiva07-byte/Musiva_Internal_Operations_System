import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupplier } from "@/lib/services/supplier.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type SupplierPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierPage({ params }: SupplierPageProps) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) {
    notFound();
  }

  const totalPurchaseValue = supplier.purchases.reduce((sum, purchase) => sum + Number(purchase.grand_total), 0);
  const lastPurchaseDate = supplier.purchases[0]?.purchase_date ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Suppliers</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{supplier.supplier_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{supplier.contact_person ?? "Supplier profile"}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/suppliers/${supplier.id}/edit`}>
              <Edit aria-hidden className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/purchases/new">
              <Plus aria-hidden className="mr-2 h-4 w-4" />
              New purchase
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{supplier.contact_person ?? "-"}</p>
            <p className="text-muted-foreground">{supplier.phone ?? "-"}</p>
            <p className="text-muted-foreground">{supplier.email ?? "-"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Purchase value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-musiva-plum">{formatBhd(totalPurchaseValue)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{supplier.purchases.length} purchase orders</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Last purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-musiva-plum">
              {lastPurchaseDate ? formatDate(lastPurchaseDate) : "-"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{supplier.country ?? "Country not saved"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplier.purchases.length === 0 ? (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            ) : (
              supplier.purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/purchases/${purchase.id}`}>
                      {purchase.purchase_number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{titleize(purchase.status)}</TableCell>
                  <TableCell>{titleize(purchase.payment_status)}</TableCell>
                  <TableCell className="text-right">{formatBhd(purchase.grand_total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
