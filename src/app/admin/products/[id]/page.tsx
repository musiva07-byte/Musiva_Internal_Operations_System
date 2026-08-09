import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockBadge } from "@/components/products/stock-badge";
import { ProductImageWidget } from "@/components/products/product-image-widget";
import { QuickAddStockDialog } from "@/components/products/quick-add-stock-dialog";
import { getProduct } from "@/lib/services/product.service";
import { getProductImage } from "@/lib/services/product-image.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageProducts, canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import {
  formatInr,
  computeProductCostSummary,
  getBuyingCostStatus,
} from "@/lib/utils/cost-conversion";
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

  // Computed once and reused by both the Business summary card and the Buying cost cards
  // below — never recalculated from a stored legacy BHD column. Profit/margin are always
  // computed inside; showProfit only gates whether the JSX renders them.
  const costSummary = showBuyingCost ? computeProductCostSummary(product.variants) : null;
  const costRows = costSummary?.rows ?? [];
  const validCostCount = costSummary?.validCostCount ?? 0;
  const missingCostCount = costSummary?.missingCostCount ?? 0;
  const hasValidCost = costSummary?.hasValidCost ?? false;
  const totalBuyingValueInr = costSummary?.totalBuyingValueInr ?? 0;
  const totalFinalCostBhd = costSummary?.totalFinalCostBhd ?? 0;
  const totalSellingValueBhd = costSummary?.totalSellingValueBhd ?? 0;
  const estimatedGrossProfit = costSummary?.estimatedGrossProfit ?? 0;
  const estimatedMargin = costSummary?.estimatedMarginPercent ?? null;

  const variantsForStock = product.variants.map((v) => ({
    id: v.id,
    color: v.color,
    size: v.size,
    stock_quantity: v.stock_quantity,
  }));

  return (
    <div className="space-y-6">
      {/* ── Top product header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-5 rounded-lg border border-musiva-border bg-card p-5 shadow-soft sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProductImageWidget
            canEdit={canEdit}
            currentUrl={image?.url ?? null}
            productId={product.id}
            size="lg"
          />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">
              {product.sku}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-musiva-plum">{product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.category?.name ?? "Uncategorized"}
              {product.collection ? ` · ${product.collection}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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
              <Badge
                variant={
                  product.online_status === "published"
                    ? "success"
                    : product.online_status === "draft"
                    ? "warning"
                    : "secondary"
                }
              >
                Website: {titleize(product.online_status)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          {canEdit && variantsForStock.length > 0 && (
            <QuickAddStockDialog
              productName={product.name}
              variants={variantsForStock}
              triggerClassName={buttonVariants({ variant: "outline" })}
            />
          )}
          <Button asChild>
            <Link href={`/admin/products/${product.id}/edit`}>
              <Edit aria-hidden className="mr-2 h-4 w-4" />
              Edit product
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Product overview ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-musiva-plum">Product overview</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total variants</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-musiva-plum">
              {product.variants.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total stock units</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-musiva-plum">{totalStock}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Collection</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{product.collection ?? "Not set"}</CardContent>
          </Card>
        </div>
      </section>

      {/* ── Business summary ────────────────────────────────────────────── */}
      {showBuyingCost && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-musiva-plum">Business summary</h2>
          <Card className="shadow-soft">
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total stock units</p>
                  <p className="mt-1 text-lg font-semibold text-musiva-plum">{totalStock}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total variants</p>
                  <p className="mt-1 text-lg font-semibold text-musiva-plum">
                    {product.variants.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variants with buying cost</p>
                  <p className="mt-1 text-lg font-semibold text-musiva-plum">{validCostCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variants missing buying cost</p>
                  <p className="mt-1 text-lg font-semibold text-musiva-plum">{missingCostCount}</p>
                </div>
              </div>

              {!hasValidCost ? (
                <p className="border-t border-[hsl(var(--border))] pt-4 text-sm text-muted-foreground">
                  No valid buying cost recorded yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 border-t border-[hsl(var(--border))] pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total buying value India (INR)</p>
                    <p className="mt-1 text-lg font-semibold text-musiva-plum">
                      {formatInr(totalBuyingValueInr)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Final stock cost Bahrain (BHD)</p>
                    <p className="mt-1 text-lg font-semibold text-musiva-plum">
                      {formatBhd(totalFinalCostBhd)}
                    </p>
                  </div>
                  {showProfit && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Estimated selling value</p>
                        <p className="mt-1 text-lg font-semibold text-musiva-plum">
                          {formatBhd(totalSellingValueBhd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estimated gross profit</p>
                        <p className="mt-1 text-lg font-semibold text-musiva-plum">
                          {formatBhd(estimatedGrossProfit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estimated margin</p>
                        <p className="mt-1 text-lg font-semibold text-musiva-plum">
                          {estimatedMargin !== null ? `${estimatedMargin.toFixed(2)}%` : "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {missingCostCount > 0 && (
                <div className="flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-musiva-warning-foreground">
                    {missingCostCount} variant{missingCostCount !== 1 ? "s are" : " is"} missing
                    buying cost.
                  </p>
                  <Link
                    className="text-sm font-medium text-musiva-plum hover:underline"
                    href={`/admin/products/${product.id}/edit`}
                  >
                    Edit product cost
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Variant stock (simplified — no cost columns) ────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-musiva-plum">Variant stock</h2>
        <Card className="shadow-soft">
          <div className="divide-y divide-[hsl(var(--border))]">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-musiva-plum">
                    {variant.color} / {variant.size}
                  </p>
                  <p className="text-xs text-muted-foreground">{variant.variant_sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-foreground">
                    {variant.stock_quantity} units
                  </span>
                  <StockBadge minimumStock={variant.minimum_stock} quantity={variant.stock_quantity} />
                  <span className="text-sm font-medium text-musiva-plum">
                    {formatBhd(variant.selling_price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ── Buying cost — variant cards, no horizontal scroll ───────────── */}
      {showBuyingCost && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-musiva-plum">Buying cost</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Per-option detail. Totals are shown in Business summary above.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {costRows.map(({ variant, cost, sellingBhd, profit, margin }) => {
              const status = getBuyingCostStatus(variant);
              return (
                <Card key={variant.id} className="shadow-soft">
                  <CardContent className="space-y-3 pt-5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-musiva-plum">
                          {variant.color} / {variant.size}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {variant.stock_quantity} units · {formatBhd(sellingBhd)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          status === "recorded" ? "success" : status === "invalid" ? "warning" : "secondary"
                        }
                        className="shrink-0"
                      >
                        {status === "recorded" ? "Recorded" : status === "invalid" ? "Invalid" : "Missing"}
                      </Badge>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[hsl(var(--border))] pt-3 text-xs">
                      <dt className="text-muted-foreground">Buy India / piece</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? (
                          formatInr(cost.buyingPriceInr)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </dd>

                      <dt className="text-muted-foreground">Rate used</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? `1 INR = BHD ${cost.exchangeRateToBhd.toFixed(6)}` : "—"}
                      </dd>

                      <dt className="text-muted-foreground">Buy Bahrain / piece</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? (
                          formatBhd(cost.convertedUnitCostBhd)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </dd>

                      <dt className="text-muted-foreground">Import / piece</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? formatBhd(cost.importCostBhd) : "—"}
                      </dd>

                      <dt className="text-muted-foreground">Final cost / piece</dt>
                      <dd className="text-right font-semibold text-musiva-plum">
                        {cost ? (
                          formatBhd(cost.finalUnitCostBhd)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </dd>

                      <dt className="text-muted-foreground">Total buy India</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? formatInr(cost.buyingPriceInr * variant.stock_quantity) : "—"}
                      </dd>

                      <dt className="text-muted-foreground">Total final cost Bahrain</dt>
                      <dd className="text-right font-medium text-foreground">
                        {cost ? formatBhd(cost.finalUnitCostBhd * variant.stock_quantity) : "—"}
                      </dd>

                      <dt className="text-muted-foreground">Selling price</dt>
                      <dd className="text-right font-medium text-foreground">
                        {formatBhd(sellingBhd)}
                      </dd>

                      {showProfit && (
                        <>
                          <dt className="text-muted-foreground">Profit / piece</dt>
                          <dd className="text-right font-medium text-foreground">
                            {profit !== null ? (
                              formatBhd(profit)
                            ) : (
                              <span className="italic text-muted-foreground">—</span>
                            )}
                          </dd>
                          <dt className="text-muted-foreground">Margin %</dt>
                          <dd className="text-right font-medium text-foreground">
                            {margin !== null ? `${margin.toFixed(2)}%` : "—"}
                          </dd>
                        </>
                      )}
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Product notes ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-musiva-plum">Product notes</h2>
        <Card>
          <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-3">
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
      </section>
    </div>
  );
}
