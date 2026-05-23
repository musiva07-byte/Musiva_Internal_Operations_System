import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getFinanceReport, getReportRange } from "@/lib/services/report.service";
import { formatBhd } from "@/lib/formatters/currency";

type FinanceReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinanceReportPage({ searchParams }: FinanceReportPageProps) {
  const params = await searchParams;
  const range = getReportRange(getParam(params, "range"));
  const report = await getFinanceReport(range);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Finance report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {range.label}. COGS uses current variant cost price as an estimate.
          </p>
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
        <Metric title="Revenue" value={formatBhd(report.revenue)} />
        <Metric title="COGS estimate" value={formatBhd(report.cogs)} />
        <Metric title="Gross profit" value={formatBhd(report.grossProfit)} />
        <Metric title="Discounts" value={formatBhd(report.discounts)} />
        <Metric title="Expenses" value={formatBhd(report.expenses)} />
        <Metric title="Estimated net profit" value={formatBhd(report.netProfit)} emphasis />
      </section>
    </div>
  );
}

function Metric({ title, value, emphasis = false }: { title: string; value: string; emphasis?: boolean }) {
  return (
    <Card className={emphasis ? "border-musiva-pink shadow-soft" : "shadow-soft"}>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-musiva-plum">{value}</p>
      </CardContent>
    </Card>
  );
}
