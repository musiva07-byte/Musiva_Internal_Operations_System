import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getReportRange, getSalesReport } from "@/lib/services/report.service";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";

type SalesReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const params = await searchParams;
  const range = getReportRange(getParam(params, "range"));
  const report = await getSalesReport(range);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Sales report</h1>
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

      <section className="grid gap-4 md:grid-cols-4">
        <Metric title="Revenue" value={formatBhd(report.revenue)} />
        <Metric title="Orders" value={String(report.orderCount)} />
        <Metric title="Average order" value={formatBhd(report.averageOrderValue)} />
        <Metric title="Discounts" value={formatBhd(report.discounts)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownTable title="By order source" rows={report.bySource} />
        <BreakdownTable title="By payment method" rows={report.byPayment} />
        <BreakdownTable title="By order status" rows={report.byStatus} />
      </div>
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

function BreakdownTable({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="h-20 text-center text-muted-foreground" colSpan={2}>
                No data.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{titleize(row.name)}</TableCell>
                <TableCell className="text-right">{formatBhd(row.value)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
