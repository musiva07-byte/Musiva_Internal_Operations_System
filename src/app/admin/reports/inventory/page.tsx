import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryReport } from "@/lib/services/report.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

export default async function InventoryReportPage() {
  const report = await getInventoryReport();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Inventory report</h1>
        <p className="mt-2 text-sm text-muted-foreground">Current stock, value, low stock, and movement history.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric title="Total units" value={String(report.totalUnits)} />
        <Metric title="Low stock" value={String(report.lowStock)} />
        <Metric title="Out of stock" value={String(report.outOfStock)} />
        <Metric title="Stock value" value={formatBhd(report.stockValue)} />
      </section>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Stock watchlist</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Cost value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.variants.slice(0, 20).map((variant) => {
              const isOut = variant.stock_quantity === 0;
              const isLow = variant.stock_quantity > 0 && variant.stock_quantity <= variant.minimum_stock;
              return (
                <TableRow key={variant.id}>
                  <TableCell>
                    <p className="font-medium text-musiva-plum">{variant.product_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {variant.color} / {variant.size}
                    </p>
                  </TableCell>
                  <TableCell>{variant.variant_sku}</TableCell>
                  <TableCell>
                    <Badge variant={isOut ? "danger" : isLow ? "warning" : "success"}>
                      {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{variant.stock_quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatBhd(variant.stock_quantity * Number(variant.cost_price))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Recent stock movements</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">New stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.recentMovements.length === 0 ? (
              <TableRow>
                <TableCell className="h-20 text-center text-muted-foreground" colSpan={4}>
                  No stock movements.
                </TableCell>
              </TableRow>
            ) : (
              report.recentMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.created_at)}</TableCell>
                  <TableCell>{titleize(movement.movement_type)}</TableCell>
                  <TableCell className="text-right">{movement.quantity}</TableCell>
                  <TableCell className="text-right">{movement.new_quantity}</TableCell>
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
