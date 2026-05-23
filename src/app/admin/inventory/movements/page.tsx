import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { listStockMovements } from "@/lib/services/inventory.service";
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type MovementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StockMovementsPage({ searchParams }: MovementsPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const movementType = getParam(params, "movementType") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const movements = await listStockMovements({ q, movementType, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (movementType !== "all") next.set("movementType", movementType);
    next.set("page", String(nextPage));
    return `/admin/inventory/movements?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Inventory</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Stock movements</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Audit trail for every stock entry, adjustment, sale deduction, return, and restore.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search product or variant" />
            </div>
            <Select defaultValue={movementType} name="movementType">
              <option value="all">All movement types</option>
              {Object.values(STOCK_MOVEMENT_TYPES).map((type) => (
                <option key={type} value={type}>
                  {titleize(type)}
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
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Previous</TableHead>
              <TableHead>New</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                  No stock movements found.
                </TableCell>
              </TableRow>
            ) : (
              movements.data.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.created_at)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-musiva-plum">{movement.product_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {movement.color} / {movement.size} - {movement.variant_sku}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{titleize(movement.movement_type)}</Badge>
                  </TableCell>
                  <TableCell className={movement.quantity < 0 ? "text-musiva-danger" : "text-musiva-sage"}>
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                  </TableCell>
                  <TableCell>{movement.previous_quantity}</TableCell>
                  <TableCell>{movement.new_quantity}</TableCell>
                  <TableCell>{movement.note ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={movements.page} pageCount={movements.pageCount} />
    </div>
  );
}
