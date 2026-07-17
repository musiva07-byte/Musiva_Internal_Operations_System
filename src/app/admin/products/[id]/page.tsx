import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockBadge } from "@/components/products/stock-badge";
import { ProductImageWidget } from "@/components/products/product-image-widget";
import { getProduct } from "@/lib/services/product.service";
import { getProductImage } from "@/lib/services/product-image.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageProducts, canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedProfit, calcEstimatedMargin, getValidBuyingCost } from "@/lib/utils/cost-conversion";
import { titleize } from "@/lib/formatters/labels";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const [product, image, auth] = await Promise.all([
    getProduct(id),
    getProductImage(id),
    getCurrentAuthState(),
  ]);

  if (!product) {
    notFound();
  }

  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock_quantity, 0);
  const role = auth.profile?.role ?? null;
  const canEdit = canManageProducts(role);
  const showBuyingCost = canViewBuyingCost(role);
  const showProfit = canViewCostData(role);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex gap-5">
          <ProductImageWidget
            canEdit={canEdit}
            currentUrl={image?.url ?? null}
            productId={product.id}
          />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">{product.sku}</p>
            <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{product.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{product.category?.name ?? "Uncategorized"}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/admin/products/${product.id}/edit`}>
            <Edit aria-hidden className="mr-2 h-4 w-4" />
            Edit product
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={product.status === "active" ? "success" : "secondary"}>{titleize(product.status)}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Variants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-musiva-plum">{product.variants.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total stock</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-musiva-plum">{totalStock}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Collection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{product.collection ?? "Not set"}</CardContent>
        </Card>
      </section>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Variant stock</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant SKU</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Selling price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {product.variants.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell className="font-medium">{variant.variant_sku}</TableCell>
                <TableCell>{variant.color}</TableCell>
                <TableCell>{variant.size}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{variant.stock_quantity}</span>
                    <StockBadge minimumStock={variant.minimum_stock} quantity={variant.stock_quantity} />
                  </div>
                </TableCell>
                <TableCell>{titleize(variant.status)}</TableCell>
                <TableCell className="text-right">{formatBhd(variant.selling_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {showBuyingCost &&
        (() => {
          const rows = product.variants.map((variant) => {
            const cost = getValidBuyingCost(variant);
            const sellingBhd = Number(variant.regular_selling_price_bhd ?? variant.selling_price);
            const profit = showProfit && cost ? calcEstimatedProfit(sellingBhd, cost.buyingPriceBhd) : null;
            const margin = showProfit && cost ? calcEstimatedMargin(sellingBhd, cost.buyingPriceBhd) : null;
            return { variant, cost, sellingBhd, profit, margin };
          });
          const validCount = rows.filter((r) => r.cost !== null).length;
          const missingCount = rows.length - validCount;
          const totalBuyingInr = rows.reduce((sum, r) => sum + (r.cost ? r.cost.buyingPriceInr * r.variant.stock_quantity : 0), 0);
          const totalBuyingBhd = rows.reduce((sum, r) => sum + (r.cost ? r.cost.buyingPriceBhd * r.variant.stock_quantity : 0), 0);
          const totalSellingBhd = rows.reduce((sum, r) => sum + (r.cost ? r.sellingBhd * r.variant.stock_quantity : 0), 0);

          return (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Buying cost</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Buy / piece (INR)</TableHead>
                    <TableHead>Rate used</TableHead>
                    <TableHead className="text-right">Buy / piece (BHD)</TableHead>
                    <TableHead className="text-right">Total buy (INR)</TableHead>
                    <TableHead className="text-right">Total buy (BHD)</TableHead>
                    <TableHead className="text-right">Selling price (BHD)</TableHead>
                    {showProfit && <TableHead className="text-right">Profit / margin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ variant, cost, sellingBhd, profit, margin }) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        {variant.color} / {variant.size}
                      </TableCell>
                      <TableCell className="text-right">{variant.stock_quantity}</TableCell>
                      <TableCell className="text-right">
                        {cost ? formatInr(cost.buyingPriceInr) : "—"}
                      </TableCell>
                      <TableCell>
                        {cost ? `1 INR = BHD ${cost.exchangeRateToBhd.toFixed(6)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {cost ? (
                          formatBhd(cost.buyingPriceBhd)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {cost ? formatInr(cost.buyingPriceInr * variant.stock_quantity) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {cost ? formatBhd(cost.buyingPriceBhd * variant.stock_quantity) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatBhd(sellingBhd)}</TableCell>
                      {showProfit && (
                        <TableCell className="text-right">
                          {profit !== null && margin !== null ? (
                            `${formatBhd(profit)} · ${margin.toFixed(2)}%`
                          ) : (
                            <span className="italic text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CardContent className="space-y-3 border-t border-[hsl(var(--border))] pt-4 text-sm">
                <p className="text-muted-foreground">
                  {validCount} option{validCount !== 1 ? "s" : ""} with recorded buying cost
                  {missingCount > 0 ? ` · ${missingCount} missing buying cost` : ""}
                </p>
                {validCount === 0 ? (
                  <p className="text-muted-foreground">No valid buying cost recorded yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="font-medium text-musiva-plum">Total stock buying value</p>
                      <p className="mt-1 text-muted-foreground">
                        {formatInr(totalBuyingInr)} / {formatBhd(totalBuyingBhd)}
                      </p>
                    </div>
                    {showProfit && (
                      <>
                        <div>
                          <p className="font-medium text-musiva-plum">Estimated selling value</p>
                          <p className="mt-1 text-muted-foreground">{formatBhd(totalSellingBhd)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-musiva-plum">Estimated gross profit</p>
                          <p className="mt-1 text-muted-foreground">
                            {formatBhd(totalSellingBhd - totalBuyingBhd)}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-musiva-plum">Estimated margin</p>
                          <p className="mt-1 text-muted-foreground">
                            {(() => {
                              const margin = calcEstimatedMargin(totalSellingBhd, totalBuyingBhd);
                              return margin !== null ? `${margin.toFixed(2)}%` : "—";
                            })()}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

      <Card>
        <CardHeader>
          <CardTitle>Product notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="font-medium text-musiva-plum">Description</p>
            <p className="mt-2 text-muted-foreground">{product.description ?? "Not provided"}</p>
          </div>
          <div>
            <p className="font-medium text-musiva-plum">Material</p>
            <p className="mt-2 text-muted-foreground">{product.material ?? "Not provided"}</p>
          </div>
          <div>
            <p className="font-medium text-musiva-plum">Care</p>
            <p className="mt-2 text-muted-foreground">{product.care_instructions ?? "Not provided"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
