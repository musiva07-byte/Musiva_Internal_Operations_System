import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { ReturnStatusBadge } from "@/components/returns/return-status-badge";
import { listReturns } from "@/lib/services/return.service";
import { RETURN_STATUSES } from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type ReturnsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const status = getParam(params, "status") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const returns = await listReturns({ q, status, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    next.set("page", String(nextPage));
    return `/admin/returns?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Returns</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Returns & exchanges</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Process returns, stock restoration, damaged items, refunds, and exchange placeholders.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/returns/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New return
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search order, customer, phone" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="all">All statuses</option>
              {Object.values(RETURN_STATUSES).map((returnStatus) => (
                <option key={returnStatus} value={returnStatus}>
                  {titleize(returnStatus)}
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
              <TableHead>Return</TableHead>
              <TableHead>Original order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Refund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                  No returns found.
                </TableCell>
              </TableRow>
            ) : (
              returns.data.map((returnRecord) => (
                <TableRow key={returnRecord.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/returns/${returnRecord.id}`}>
                      {formatDate(returnRecord.created_at)}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{titleize(returnRecord.reason)}</p>
                  </TableCell>
                  <TableCell>{returnRecord.order_number}</TableCell>
                  <TableCell>
                    <p>{returnRecord.customer_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{returnRecord.customer_mobile}</p>
                  </TableCell>
                  <TableCell>{titleize(returnRecord.return_type)}</TableCell>
                  <TableCell>
                    <ReturnStatusBadge status={returnRecord.status} />
                  </TableCell>
                  <TableCell>{returnRecord.item_count}</TableCell>
                  <TableCell className="text-right">{formatBhd(returnRecord.refund_amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={returns.page} pageCount={returns.pageCount} />
    </div>
  );
}
