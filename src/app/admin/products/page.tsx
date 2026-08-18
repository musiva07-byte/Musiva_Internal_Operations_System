import Link from "next/link";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { ProductRowActions } from "@/components/products/product-row-actions";
import { ProductCostDialog } from "@/components/products/product-cost-dialog";
import { WebsiteStatusControl } from "@/components/products/website-status-control";
import { ExportMenu } from "@/components/reports/export-menu";
import { listCategories, listProducts } from "@/lib/services/product.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canPublishProducts, canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { getCostSummaryBadge } from "@/lib/utils/cost-conversion";
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
  const website = (getParam(params, "website") ?? "") as
    | "published"
    | "draft"
    | "hidden"
    | "missing_details"
    | "";
  const page = Number(getParam(params, "page") ?? 1);

  const [categories, products, auth] = await Promise.all([
    listCategories(),
    listProducts({ q, status, categoryId, page, websiteFilter: website }),
    getCurrentAuthState(),
  ]);

  const userRole = auth.profile?.role ?? null;
  const showCostView = canViewBuyingCost(userRole);
  const showProfit = canViewCostData(userRole);
  const canPublish = canPublishProducts(userRole);

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (categoryId !== "all") next.set("categoryId", categoryId);
    if (website) next.set("website", website);
    next.set("page", String(nextPage));
    return `/admin/products?${next.toString()}`;
  };

  const showingArchived = status === "archived" || status === "all";
  const isUnfilteredEmptyState = !q && !status && categoryId === "all" && !website;

  const exportQuery = (() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (categoryId !== "all") next.set("categoryId", categoryId);
    if (website) next.set("website", website);
    return next.toString();
  })();

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
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            csvHref={`/api/admin/products/export${exportQuery ? `?${exportQuery}` : ""}`}
            printHref={`/print/products${exportQuery ? `?${exportQuery}` : ""}`}
          />
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus aria-hidden className="mr-2 h-4 w-4" />
              New product
            </Link>
          </Button>
        </div>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto]">
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
            <Select defaultValue={website} name="website">
              <option value="">Website: All</option>
              <option value="published">Website: Published</option>
              <option value="draft">Website: Draft</option>
              <option value="hidden">Website: Hidden</option>
              <option value="missing_details">Website: Missing details</option>
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

      {products.loadError || products.data.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="flex h-40 items-center justify-center text-center text-muted-foreground">
            {products.loadError ? (
              products.loadError
            ) : isUnfilteredEmptyState ? (
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
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop/tablet: compact fixed-layout table — table-fixed + column-width caps
              guarantee the table never grows past its container, so no horizontal scrollbar. */}
          <Card className="hidden shadow-soft md:block">
            <Table className="min-w-0 table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead className={showCostView ? "w-[24%]" : "w-[28%]"}>Product</TableHead>
                  <TableHead className={showCostView ? "w-[12%]" : "w-[14%]"}>Category</TableHead>
                  <TableHead className={showCostView ? "w-[13%]" : "w-[15%]"}>Stock</TableHead>
                  <TableHead className={showCostView ? "w-[17%]" : "w-[20%]"}>Status</TableHead>
                  {showCostView ? <TableHead className="w-[15%]">Cost</TableHead> : null}
                  <TableHead className={showCostView ? "w-[11%] text-right" : "w-[15%] text-right"}>
                    Price
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.data.map((product) => {
                  const costBadge = getCostSummaryBadge(
                    product.cost_summary.validCostCount,
                    product.cost_summary.missingCostCount,
                  );
                  return (
                    <TableRow
                      key={product.id}
                      className={product.status === "archived" ? "opacity-60" : undefined}
                    >
                      <TableCell>
                        <ProductThumbnail name={product.name} url={product.primary_image_url} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Link
                          className="block truncate font-medium text-musiva-plum hover:underline"
                          href={`/admin/products/${product.id}`}
                        >
                          {product.name}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{product.sku}</p>
                      </TableCell>
                      <TableCell className="truncate text-sm">
                        {product.category_name ?? "Uncategorized"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1 text-sm">
                          <p className="font-medium text-musiva-plum">{product.total_stock} units</p>
                          <p className="text-xs text-muted-foreground">
                            {product.variant_count} option{product.variant_count !== 1 ? "s" : ""}
                          </p>
                          {product.out_of_stock_count > 0 ? (
                            <Badge className="text-[10px]" variant="danger">
                              Out {product.out_of_stock_count}
                            </Badge>
                          ) : product.low_stock_count > 0 ? (
                            <Badge className="text-[10px]" variant="warning">
                              Low {product.low_stock_count}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
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
                          <WebsiteStatusControl
                            canPublish={canPublish}
                            onlineStatus={product.online_status}
                            productId={product.id}
                            productName={product.name}
                            websiteReady={product.website_ready}
                          />
                          {!product.website_ready ? (
                            <Badge className="text-[10px]" variant="danger">
                              Missing details
                            </Badge>
                          ) : null}
                          {product.status === "archived" && product.total_stock > 0 ? (
                            <Badge className="text-[10px]" variant="warning">
                              Has stock
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {showCostView ? (
                        <TableCell>
                          <ProductCostDialog
                            productId={product.id}
                            productName={product.name}
                            categoryName={product.category_name}
                            totalStock={product.total_stock}
                            costSummary={product.cost_summary}
                            showProfit={showProfit}
                            trigger={
                              <button
                                className="inline-flex items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                type="button"
                              >
                                <Badge className="text-[10px]" variant={costBadge.variant}>
                                  {costBadge.label}
                                </Badge>
                                <ChevronDown aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
                              </button>
                            }
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm">
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
                          categoryName={product.category_name}
                          variantsQuick={product.variants_quick}
                          userRole={userRole}
                          costView={
                            showCostView
                              ? {
                                  totalStock: product.total_stock,
                                  costSummary: product.cost_summary,
                                  showProfit,
                                }
                              : undefined
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked cards instead of a cramped/scrolling table. */}
          <div className="space-y-3 md:hidden">
            {products.data.map((product) => {
              const costBadge = getCostSummaryBadge(
                product.cost_summary.validCostCount,
                product.cost_summary.missingCostCount,
              );
              return (
                <Card
                  key={product.id}
                  className={product.status === "archived" ? "shadow-soft opacity-60" : "shadow-soft"}
                >
                  <CardContent className="flex gap-3 pt-4">
                    <ProductThumbnail name={product.name} url={product.primary_image_url} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            className="block truncate font-medium text-musiva-plum hover:underline"
                            href={`/admin/products/${product.id}`}
                          >
                            {product.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.sku} · {product.category_name ?? "Uncategorized"}
                          </p>
                        </div>
                        <ProductRowActions
                          productId={product.id}
                          productName={product.name}
                          productStatus={product.status}
                          categoryName={product.category_name}
                          variantsQuick={product.variants_quick}
                          userRole={userRole}
                          costView={
                            showCostView
                              ? {
                                  totalStock: product.total_stock,
                                  costSummary: product.cost_summary,
                                  showProfit,
                                }
                              : undefined
                          }
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
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
                        <WebsiteStatusControl
                          canPublish={canPublish}
                          onlineStatus={product.online_status}
                          productId={product.id}
                          productName={product.name}
                          websiteReady={product.website_ready}
                        />
                        {!product.website_ready ? (
                          <Badge className="text-[10px]" variant="danger">Missing details</Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>
                          {product.total_stock} units · {product.variant_count} option
                          {product.variant_count !== 1 ? "s" : ""}
                        </span>
                        {product.out_of_stock_count > 0 ? (
                          <Badge className="text-[10px]" variant="danger">
                            Out {product.out_of_stock_count}
                          </Badge>
                        ) : product.low_stock_count > 0 ? (
                          <Badge className="text-[10px]" variant="warning">
                            Low {product.low_stock_count}
                          </Badge>
                        ) : null}
                        {product.status === "archived" && product.total_stock > 0 ? (
                          <Badge className="text-[10px]" variant="warning">Has stock</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-musiva-plum">
                            {product.min_selling_price === null ? "—" : formatBhd(product.min_selling_price)}
                          </span>
                          {product.has_active_discount ? (
                            <Badge className="text-[10px]" variant="warning">Sale</Badge>
                          ) : null}
                        </div>
                        {showCostView ? (
                          <ProductCostDialog
                            productId={product.id}
                            productName={product.name}
                            categoryName={product.category_name}
                            totalStock={product.total_stock}
                            costSummary={product.cost_summary}
                            showProfit={showProfit}
                            trigger={
                              <button
                                className="inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                type="button"
                              >
                                <Badge className="text-[10px]" variant={costBadge.variant}>
                                  {costBadge.label}
                                </Badge>
                                <ChevronDown aria-hidden className="h-3 w-3 text-muted-foreground" />
                              </button>
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Pagination href={hrefForPage} page={products.page} pageCount={products.pageCount} />
    </div>
  );
}
