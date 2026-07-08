import Link from "next/link";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { QuickAddStockDialog } from "@/components/products/quick-add-stock-dialog";
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
          <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search name, SKU, collection" />
            </div>
            <Select defaultValue={status} name="status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
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
            {products.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={8}>
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.data.map((product) => (
                <TableRow key={product.id}>
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === "active" ? "success" : "secondary"}>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Actions for ${product.name}`}
                          className="h-8 w-8"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal aria-hidden className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}`}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}/edit`}>Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}`}>Manage image</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild={false} className="p-0">
                          {product.variants_quick.length > 0 ? (
                            <QuickAddStockDialog
                              productName={product.name}
                              variants={product.variants_quick}
                            />
                          ) : (
                            <span className="flex w-full cursor-not-allowed items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                              Add stock
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            className="text-destructive focus:text-destructive"
                            href={`/admin/products/${product.id}/edit?archive=1`}
                          >
                            Archive
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
