"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedProfit, calcEstimatedMargin, getCostSummaryBadge } from "@/lib/utils/cost-conversion";

type VariantCostRow = {
  id: string;
  color: string;
  size: string;
  stockQuantity: number;
  buyingPriceInr: number | null;
  exchangeRateToBhd: number | null;
  convertedUnitCostBhd: number | null;
  /** Import cost per piece (BHD) — cargo, customs, packing, transfer, or delivery. 0 when not entered. */
  importCostBhd: number | null;
  finalUnitCostBhd: number | null;
  sellingPriceBhd: number;
};

type CostSummary = {
  validCostCount: number;
  missingCostCount: number;
  totalBuyingValueInr: number;
  totalFinalCostBhd: number;
  totalSellingValueBhd: number;
  variants: VariantCostRow[];
};

type Props = {
  productId: string;
  productName: string;
  categoryName: string | null;
  totalStock: number;
  costSummary: CostSummary;
  /** Owner/manager/accountant only — gates selling value, gross profit, and margin. */
  showProfit: boolean;
  /** Custom trigger element (e.g. the Cost Status badge itself). Defaults to a plain
   *  "View cost" text link styled for use inside a dropdown menu item. */
  trigger?: React.ReactNode;
};

export function ProductCostDialog({
  productId,
  productName,
  categoryName,
  totalStock,
  costSummary,
  showProfit,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const hasValidCost = costSummary.validCostCount > 0;
  const hasMissingCost = costSummary.missingCostCount > 0;
  const variantCount = costSummary.variants.length;
  const costBadge = getCostSummaryBadge(costSummary.validCostCount, costSummary.missingCostCount);
  const estimatedGrossProfit = costSummary.totalSellingValueBhd - costSummary.totalFinalCostBhd;
  const estimatedMargin = hasValidCost
    ? calcEstimatedMargin(costSummary.totalSellingValueBhd, costSummary.totalFinalCostBhd)
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="flex w-full items-center gap-2 px-2 py-1.5 text-sm" type="button">
            <DollarSign aria-hidden className="h-4 w-4" />
            View cost
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Product Business Summary</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          {/* ── Top area: product identity + cost status ─────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="mt-1 font-medium text-musiva-plum">{categoryName ?? "Uncategorized"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total variants</p>
              <p className="mt-1 font-medium text-musiva-plum">{variantCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total stock</p>
              <p className="mt-1 font-medium text-musiva-plum">{totalStock}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">With buying cost</p>
              <p className="mt-1 font-medium text-musiva-plum">{costSummary.validCostCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Missing buying cost</p>
              <p className="mt-1 font-medium text-musiva-plum">{costSummary.missingCostCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost status</p>
              <p className="mt-1">
                <Badge variant={costBadge.variant}>{costBadge.label}</Badge>
              </p>
            </div>
          </div>

          {/* ── Missing cost warning ─────────────────────────────────── */}
          {hasMissingCost && (
            <div className="flex flex-col gap-2 rounded-md border border-musiva-warning/25 bg-musiva-warning/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-musiva-warning-foreground">
                {costSummary.missingCostCount} variant{costSummary.missingCostCount !== 1 ? "s are" : " is"} missing
                buying cost.
              </p>
              <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/products/${productId}`}>
                Open product
              </Link>
            </div>
          )}

          {/* ── Summary cards ─────────────────────────────────────────── */}
          <div className="border-t border-[hsl(var(--border))] pt-4">
            {!hasValidCost ? (
              <p className="text-muted-foreground">No valid buying cost recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total buying value India (INR)</p>
                  <p className="mt-1 font-medium text-musiva-plum">
                    {formatInr(costSummary.totalBuyingValueInr)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final stock cost Bahrain (BHD)</p>
                  <p className="mt-1 font-medium text-musiva-plum">
                    {formatBhd(costSummary.totalFinalCostBhd)}
                  </p>
                </div>
                {showProfit && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated selling value (BHD)</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {formatBhd(costSummary.totalSellingValueBhd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated gross profit (BHD)</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {formatBhd(estimatedGrossProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated margin %</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {estimatedMargin !== null ? `${estimatedMargin.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Per-variant details — cards only, never a horizontal-scroll table ── */}
          <div className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
            {costSummary.variants.map((variant) => {
              const hasCost = variant.finalUnitCostBhd !== null;
              const profit =
                showProfit && hasCost
                  ? calcEstimatedProfit(variant.sellingPriceBhd, variant.finalUnitCostBhd!)
                  : null;
              const margin =
                showProfit && hasCost
                  ? calcEstimatedMargin(variant.sellingPriceBhd, variant.finalUnitCostBhd!)
                  : null;

              return (
                <div key={variant.id} className="rounded-md border border-[hsl(var(--border))] p-3">
                  {/* Card header: variant name, qty, cost status, selling price */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-musiva-plum">
                        {variant.color} / {variant.size}
                      </p>
                      <span className="text-xs text-muted-foreground">Qty: {variant.stockQuantity}</span>
                      <Badge variant={hasCost ? "success" : "secondary"} className="text-[10px]">
                        {hasCost ? "Recorded" : "Missing"}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-musiva-plum">
                      {formatBhd(variant.sellingPriceBhd)}
                    </p>
                  </div>

                  {/* Card body */}
                  {!hasCost ? (
                    <p className="mt-3 border-t border-[hsl(var(--border))] pt-3 text-sm italic text-muted-foreground">
                      Buying cost not recorded yet.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-[hsl(var(--border))] pt-3 text-xs sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Buy India / piece</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatInr(variant.buyingPriceInr!)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate used</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          1 INR = BHD {variant.exchangeRateToBhd!.toFixed(6)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Buy Bahrain / piece</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatBhd(variant.convertedUnitCostBhd!)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Import / piece</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatBhd(variant.importCostBhd ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Final cost / piece</p>
                        <p className="mt-0.5 font-semibold text-musiva-plum">
                          {formatBhd(variant.finalUnitCostBhd!)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total buy India</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatInr(variant.buyingPriceInr! * variant.stockQuantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total final cost Bahrain</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatBhd(variant.finalUnitCostBhd! * variant.stockQuantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Selling price</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formatBhd(variant.sellingPriceBhd)}
                        </p>
                      </div>
                      {showProfit && (
                        <div>
                          <p className="text-muted-foreground">Profit / Margin</p>
                          <p className="mt-0.5 font-medium text-foreground">
                            {profit !== null && margin !== null
                              ? `${formatBhd(profit)} · ${margin.toFixed(2)}%`
                              : "—"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
