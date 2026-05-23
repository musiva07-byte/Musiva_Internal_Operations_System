import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomerReport, getReportRange } from "@/lib/services/report.service";
import { formatBhd } from "@/lib/formatters/currency";

type CustomerReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerReportPage({ searchParams }: CustomerReportPageProps) {
  const params = await searchParams;
  const range = getReportRange(getParam(params, "range"));
  const report = await getCustomerReport(range);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Customer report</h1>
          <p className="mt-2 text-sm text-muted-foreground">{range.label}</p>
        </div>
        <form className="flex gap-2">
          <Select defaultValue={range.preset} name="range">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </Select>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title="New customers" value={String(report.newCustomers)} />
        <Metric title="Repeat customers" value={String(report.repeatCustomers)} />
        <Metric title="Top customer count" value={String(report.topCustomers.length)} />
      </section>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Top customers</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead className="text-right">Spending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.topCustomers.length === 0 ? (
              <TableRow>
                <TableCell className="h-20 text-center text-muted-foreground" colSpan={3}>
                  No customer order data.
                </TableCell>
              </TableRow>
            ) : (
              report.topCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/customers/${customer.id}`}>
                      {customer.full_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{customer.mobile}</p>
                  </TableCell>
                  <TableCell>{customer.order_count}</TableCell>
                  <TableCell className="text-right">{formatBhd(customer.total_spending)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-musiva-plum">{value}</p>
      </CardContent>
    </Card>
  );
}
