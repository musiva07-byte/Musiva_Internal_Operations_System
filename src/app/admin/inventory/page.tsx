import Link from "next/link";
import { ClipboardList, MoreHorizontal, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { StockBadge } from "@/components/products/stock-badge";
import { listInventoryVariants } from "@/lib/services/inventory.service";
import { getCurrentStaffProfile } from "@/lib/auth/session";
import { canViewBuyingCost } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, getValidBuyingCost } from "@/lib/utils/cost-conversion";

type InventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const [params, profile] = await Promise.all([searchParams, getCurrentStaffProfile()]);
  const q = getParam(params, "q") ?? "";
  const stock = getParam(params, "stock") ?? "all";
  // Default "active" excludes archived variants; "archived" shows only archived; "all" shows everything
  const productStatus = getParam(params, "productStatus") ?? "active";
  const page = Number(getParam(params, "page") ?? 1);
  const variants = await listInventoryVariants({ q, stock, productStatus, page });

  const showCost = canViewBuyingCost(profile?.role);

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (stock !== "all") next.set("stock", stock);
    if (productStatus !== "active") next.set("productStatus", productStatus);
    next.set("page", String(nextPage));
    return `/admin/inventory?${next.toString()}`;
  };

  const totalCols = showCost ? 8 : 7;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Stock</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Stock Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Check available stock and add items as they arrive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/inventory/movements">
              <ClipboardList aria-hidden className="mr-2 h-4 w-4" />
              Stock history
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/inventory/adjustments">
              <SlidersHorizontal aria-hidden className="mr-2 h-4 w-4" />
              Correct quantity
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/inventory/stock-entry">
              <PackagePlus aria-hidden className="mr-2 h-4 w-4" />
              Receive stock
            </Link>
          </Button>
        </div>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_200px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search product, color, size, SKU" />
            </div>
            <Select defaultValue={stock} name="stock">
              <option value="all">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
            <Select defaultValue={productStatus} name="productStatus">
              <option value="active">Active stock</option>
              <option value="archived">Archived products</option>
              <option value="all">All products</option>
            </Select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>
          {productStatus === "archived" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing archived products. These are hidden from new sales.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[56px]">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Size / color</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Alert at</TableHead>
              <TableHead>Status</TableHead>
              {showCost ? <TableHead>Buying cost</TableHead> : null}
              <TableHead>Price</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.loadError ? (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={totalCols}
                >
                  {variants.loadError}
                </TableCell>
              </TableRow>
            ) : variants.data.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={totalCols}
                >
                  {!q && stock === "all" && productStatus === "active" ? (
                    <div>
                      <p className="font-medium text-foreground">No stock records yet.</p>
                      <p>Add a product first, then receive stock.</p>
                    </div>
                  ) : (
                    "No stock records found."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              variants.data.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    <ProductThumbnail
                      name={variant.product_name}
                      size="sm"
                      url={variant.primary_image_url}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-musiva-plum">{variant.product_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{variant.product_sku}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {variant.color} / {variant.size}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{variant.variant_sku}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-lg font-semibold tabular-nums text-musiva-plum">
                      {variant.stock_quantity}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">units</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {variant.minimum_stock}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StockBadge
                      minimumStock={variant.minimum_stock}
                      quantity={variant.stock_quantity}
                    />
                  </TableCell>
                  {showCost ? (
                    <TableCell>
                      {(() => {
                        const cost = getValidBuyingCost(variant);
                        if (!cost) {
                          return (
                            <div className="space-y-1 text-xs">
                              <p className="italic text-muted-foreground/60">Not recorded</p>
                              <Badge className="text-[10px]" variant="secondary">Missing</Badge>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-0.5 text-xs">
                            <p className="text-muted-foreground">
                              Buy: <span className="font-medium text-foreground">{formatInr(cost.buyingPriceInr)}</span>
                              {" → "}
                              <span className="font-medium text-foreground">{formatBhd(cost.convertedUnitCostBhd)}</span>
                            </p>
                            {cost.additionalLandedCostBhd > 0 && (
                              <p className="text-muted-foreground">
                                + Additional:{" "}
                                <span className="font-medium text-foreground">
                                  {formatBhd(cost.additionalLandedCostBhd)}
                                </span>
                              </p>
                            )}
                            <p className="text-muted-foreground">
                              Final:{" "}
                              <span className="font-medium text-foreground">{formatBhd(cost.finalUnitCostBhd)}</span>
                            </p>
                            <p className="text-muted-foreground">
                              Total final cost:{" "}
                              <span className="font-medium text-foreground">
                                {formatBhd(cost.finalUnitCostBhd * variant.stock_quantity)}
                              </span>
                            </p>
                            <Badge className="text-[10px]" variant="success">Recorded</Badge>
                          </div>
                        );
                      })()}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="space-y-0.5 text-sm">
                      <p className="font-medium text-musiva-plum">
                        {formatBhd(
                          variant.regular_selling_price_bhd ?? variant.selling_price,
                        )}
                      </p>
                      {variant.pricing_status === "on_sale" &&
                      variant.discount_price_bhd !== null ? (
                        <Badge className="text-[10px]" variant="warning">
                          Sale: {formatBhd(variant.discount_price_bhd)}
                        </Badge>
                      ) : null}
                      {variant.pricing_status === "discount_scheduled" ? (
                        <Badge className="text-[10px]" variant="secondary">
                          Sale scheduled
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/inventory/stock-entry?variantId=${variant.id}`}
                          title="Add stock"
                        >
                          <PackagePlus aria-hidden className="h-4 w-4" />
                          <span className="sr-only">Add stock</span>
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`More actions for ${variant.product_name} ${variant.color} ${variant.size}`}
                            className="h-8 w-8"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreHorizontal aria-hidden className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/inventory/adjustments?variantId=${variant.id}`}>
                              Correct stock quantity
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/inventory/movements?variantId=${variant.id}`}>
                              View stock history
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${variant.product_id}`}>
                              Open product
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
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
