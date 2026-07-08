import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { ProductRowActions } from "@/components/products/product-row-actions";
import { listCategories, listProducts } from "@/lib/services/product.service";
import { getCurrentAuthState } from "@/lib/auth/session";
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
  // Default is "" (active + inactive, archived excluded) — "all" shows everything
  const status = getParam(params, "status") ?? "";
  const categoryId = getParam(params, "categoryId") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);

  const [categories, products, auth] = await Promise.all([
    listCategories(),
    listProducts({ q, status, categoryId, page }),
    getCurrentAuthState(),
  ]);

  const userRole = auth.profile?.role ?? null;

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (categoryId !== "all") next.set("categoryId", categoryId);
    next.set("page", String(nextPage));
    return `/admin/products?${next.toString()}`;
  };

  const showingArchived = status === "archived" || status === "all";
  const isUnfilteredEmptyState = !q && !status && categoryId === "all";

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Catalog</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Product Catalog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage product details, images, categories, pricing, and size/color options.
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
          <form className="grid gap-3 md:grid-cols-[1fr_200px_220px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search name, SKU, collection" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="">Active &amp; Inactive</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
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
          {showingArchived && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing archived products. Archived products are hidden from new sales and normal stock selection.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[72px]">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Total stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">From price</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.loadError ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={8}>
                  {products.loadError}
                </TableCell>
              </TableRow>
            ) : products.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={8}>
                  {isUnfilteredEmptyState ? (
                    <div className="flex flex-col items-center gap-3">
                      <div>
                        <p className="font-medium text-foreground">No products yet.</p>
                        <p>Add your first product to start managing Moosiva stock.</p>
                      </div>
                      <Button asChild size="sm">
                        <Link href="/admin/products/new">Add product</Link>
                      </Button>
                    </div>
                  ) : status === "archived" ? (
                    "No archived products."
                  ) : (
                    "No products found."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              products.data.map((product) => (
                <TableRow
                  key={product.id}
                  className={product.status === "archived" ? "opacity-60" : undefined}
                >
                  <TableCell>
                    <ProductThumbnail name={product.name} url={product.primary_image_url} />
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium text-musiva-plum hover:underline"
                      href={`/admin/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{product.sku}</p>
                  </TableCell>
                  <TableCell>{product.category_name ?? "Uncategorized"}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {product.variant_count} option{product.variant_count !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={product.out_of_stock_count > 0 ? "danger" : "success"}>
                        {product.total_stock} units
                      </Badge>
                      {product.low_stock_count > 0 ? (
                        <Badge variant="warning">Low {product.low_stock_count}</Badge>
                      ) : null}
                      {product.status === "archived" && product.total_stock > 0 ? (
                        <Badge variant="warning">Archived — stock remaining</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        product.status === "active"
                          ? "success"
                          : product.status === "archived"
                          ? "danger"
                          : "secondary"
                      }
                    >
                      {titleize(product.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span>
                        {product.min_selling_price === null ? "—" : formatBhd(product.min_selling_price)}
                      </span>
                      {product.has_active_discount ? (
                        <Badge className="text-[10px]" variant="warning">Sale</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProductRowActions
                      productId={product.id}
                      productName={product.name}
                      productStatus={product.status}
                      variantsQuick={product.variants_quick}
                      userRole={userRole}
                    />
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
