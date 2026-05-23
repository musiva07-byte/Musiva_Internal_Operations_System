import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { listCategories, listProducts } from "@/lib/services/product.service";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const status = getParam(params, "status") ?? "all";
  const categoryId = getParam(params, "categoryId") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts({ q, status, categoryId, page }),
  ]);

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (categoryId !== "all") next.set("categoryId", categoryId);
    next.set("page", String(nextPage));
    return `/admin/products?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Products</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Product catalog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage boutique products, categories, images, and color/size variants.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New product
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search name, SKU, collection" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
            <Select defaultValue={categoryId} name="categoryId">
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">From price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/products/${product.id}`}>
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{product.sku}</p>
                  </TableCell>
                  <TableCell>{product.category_name ?? "Uncategorized"}</TableCell>
                  <TableCell>{product.variant_count}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={product.out_of_stock_count > 0 ? "danger" : "success"}>
                        {product.total_stock} units
                      </Badge>
                      {product.low_stock_count > 0 ? <Badge variant="warning">Low {product.low_stock_count}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === "active" ? "success" : "secondary"}>
                      {titleize(product.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.min_selling_price === null ? "-" : formatBhd(product.min_selling_price)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={products.page} pageCount={products.pageCount} />
    </div>
  );
}
