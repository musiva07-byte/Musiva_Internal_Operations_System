import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { CustomerRowActions } from "@/components/customers/customer-row-actions";
import { listCustomers } from "@/lib/services/customer.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { formatBahrainPhone } from "@/lib/utils/phone";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const page = Number(getParam(params, "page") ?? 1);
  const customers = await listCustomers({ q, page });
  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(nextPage));
    return `/admin/customers?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Customers</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Customer records</h1>
          <p className="mt-2 text-sm text-muted-foreground">Search by customer name, mobile, or WhatsApp.</p>
        </div>
        <Button asChild>
          <Link href="/admin/customers/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New customer
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search customers" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Governorate</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Total spending</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.data.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/customers/${customer.id}`}>
                      {customer.full_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{customer.email ?? "No email"}</p>
                  </TableCell>
                  <TableCell>{formatBahrainPhone(customer.mobile_normalized) || customer.mobile}</TableCell>
                  <TableCell>{customer.governorate ?? "-"}</TableCell>
                  <TableCell>{customer.order_count}</TableCell>
                  <TableCell>{formatBhd(customer.total_spending)}</TableCell>
                  <TableCell>{customer.last_order_at ? formatDate(customer.last_order_at) : "-"}</TableCell>
                  <TableCell>
                    <CustomerRowActions customer={customer} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={customers.page} pageCount={customers.pageCount} />
    </div>
  );
}
