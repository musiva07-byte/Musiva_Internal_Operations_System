import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { listSuppliers } from "@/lib/services/supplier.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

type SuppliersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const page = Number(getParam(params, "page") ?? 1);
  const suppliers = await listSuppliers({ q, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(nextPage));
    return `/admin/suppliers?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Suppliers</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Supplier directory</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage vendor details and review purchase history for boutique stock sourcing.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/suppliers/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New supplier
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search supplier, contact, phone" />
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
              <TableHead>Supplier</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Purchases</TableHead>
              <TableHead>Last purchase</TableHead>
              <TableHead className="text-right">Total value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.data.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/suppliers/${supplier.id}`}>
                      {supplier.supplier_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{supplier.country ?? "No country saved"}</p>
                  </TableCell>
                  <TableCell>
                    <p>{supplier.contact_person ?? "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{supplier.phone ?? supplier.email ?? "-"}</p>
                  </TableCell>
                  <TableCell>{supplier.purchase_count}</TableCell>
                  <TableCell>{supplier.last_purchase_date ? formatDate(supplier.last_purchase_date) : "-"}</TableCell>
                  <TableCell className="text-right">{formatBhd(supplier.total_purchase_value)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={suppliers.page} pageCount={suppliers.pageCount} />
    </div>
  );
}
