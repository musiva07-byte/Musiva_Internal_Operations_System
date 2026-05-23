import Link from "next/link";
import { ClipboardList, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { StockBadge } from "@/components/products/stock-badge";
import { listInventoryVariants } from "@/lib/services/inventory.service";
import { formatBhd } from "@/lib/formatters/currency";

type InventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const stock = getParam(params, "stock") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const variants = await listInventoryVariants({ q, stock, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (stock !== "all") next.set("stock", stock);
    next.set("page", String(nextPage));
    return `/admin/inventory?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Inventory</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Variant stock</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Stock is tracked per product variant by color and size.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/inventory/movements">
              <ClipboardList aria-hidden className="mr-2 h-4 w-4" />
              Movements
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/inventory/adjustments">
              <SlidersHorizontal aria-hidden className="mr-2 h-4 w-4" />
              Adjust
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/inventory/stock-entry">
              <Plus aria-hidden className="mr-2 h-4 w-4" />
              Add stock
            </Link>
          </Button>
        </div>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search SKU, barcode, color, size" />
            </div>
            <Select defaultValue={stock} name="stock">
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
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
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Minimum</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>
                  No inventory variants found.
                </TableCell>
              </TableRow>
            ) : (
              variants.data.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    <p className="font-medium text-musiva-plum">{variant.product_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{variant.product_sku}</p>
                  </TableCell>
                  <TableCell>
                    <p>{variant.color} / {variant.size}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{variant.variant_sku}</p>
                  </TableCell>
                  <TableCell>{variant.category_name ?? "Uncategorized"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{variant.stock_quantity}</span>
                      <StockBadge minimumStock={variant.minimum_stock} quantity={variant.stock_quantity} />
                    </div>
                  </TableCell>
                  <TableCell>{variant.minimum_stock}</TableCell>
                  <TableCell className="text-right">{formatBhd(variant.selling_price)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={variants.page} pageCount={variants.pageCount} />
    </div>
  );
}
