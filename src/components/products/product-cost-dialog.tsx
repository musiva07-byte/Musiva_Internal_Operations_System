"use client";

import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedMargin } from "@/lib/utils/cost-conversion";

type VariantCostRow = {
  id: string;
  color: string;
  size: string;
  stockQuantity: number;
  buyingPriceInr: number | null;
  exchangeRateToBhd: number | null;
  convertedUnitCostBhd: number | null;
  /** Optional advanced field — cargo/customs/packaging/etc per piece. 0 when not entered. */
  additionalLandedCostBhd: number | null;
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
  productName: string;
  totalStock: number;
  costSummary: CostSummary;
  /** Owner/manager/accountant only — gates selling value, gross profit, and margin. */
  showProfit: boolean;
};

export function ProductCostDialog({ productName, totalStock, costSummary, showProfit }: Props) {
  const [open, setOpen] = useState(false);
  const hasValidCost = costSummary.validCostCount > 0;
  const estimatedGrossProfit = costSummary.totalSellingValueBhd - costSummary.totalFinalCostBhd;
  const estimatedMargin = hasValidCost
    ? calcEstimatedMargin(costSummary.totalSellingValueBhd, costSummary.totalFinalCostBhd)
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 px-2 py-1.5 text-sm" type="button">
          <DollarSign aria-hidden className="h-4 w-4" />
          View cost
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buying cost — {productName}</DialogTitle>
          <DialogDescription>Product-level summary and per-option breakdown.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Total stock quantity</p>
              <p className="mt-1 font-medium text-musiva-plum">{totalStock}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valid buying cost</p>
              <p className="mt-1 font-medium text-musiva-plum">{costSummary.validCostCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Missing buying cost</p>
              <p className="mt-1 font-medium text-musiva-plum">{costSummary.missingCostCount}</p>
            </div>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            {!hasValidCost ? (
              <p className="text-muted-foreground">No valid buying cost recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total buying value (INR)</p>
                  <p className="mt-1 font-medium text-musiva-plum">
                    {formatInr(costSummary.totalBuyingValueInr)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total final cost (BHD)</p>
                  <p className="mt-1 font-medium text-musiva-plum">
                    {formatBhd(costSummary.totalFinalCostBhd)}
                  </p>
                </div>
                {showProfit && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Selling value (BHD)</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {formatBhd(costSummary.totalSellingValueBhd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated gross profit</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {formatBhd(estimatedGrossProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated margin</p>
                      <p className="mt-1 font-medium text-musiva-plum">
                        {estimatedMargin !== null ? `${estimatedMargin.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Buy/piece (INR)</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Converted (BHD)</TableHead>
                  <TableHead className="text-right">Additional cost (BHD)</TableHead>
                  <TableHead className="text-right">Final buy/piece (BHD)</TableHead>
                  <TableHead className="text-right">Total buy (INR)</TableHead>
                  <TableHead className="text-right">Total final (BHD)</TableHead>
                  <TableHead className="text-right">Sell (BHD)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costSummary.variants.map((variant) => {
                  const hasCost = variant.finalUnitCostBhd !== null;
                  return (
                    <TableRow key={variant.id}>
                      <TableCell>
                        {variant.color} / {variant.size}
                      </TableCell>
                      <TableCell className="text-right">{variant.stockQuantity}</TableCell>
                      <TableCell className="text-right">
                        {variant.buyingPriceInr !== null ? formatInr(variant.buyingPriceInr) : "—"}
                      </TableCell>
                      <TableCell>
                        {variant.exchangeRateToBhd !== null
                          ? `1 INR = BHD ${variant.exchangeRateToBhd.toFixed(6)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {variant.convertedUnitCostBhd !== null ? (
                          formatBhd(variant.convertedUnitCostBhd)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasCost ? formatBhd(variant.additionalLandedCostBhd ?? 0) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasCost ? (
                          formatBhd(variant.finalUnitCostBhd!)
                        ) : (
                          <span className="italic text-muted-foreground">Not recorded</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {variant.buyingPriceInr !== null
                          ? formatInr(variant.buyingPriceInr * variant.stockQuantity)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasCost ? formatBhd(variant.finalUnitCostBhd! * variant.stockQuantity) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatBhd(variant.sellingPriceBhd)}</TableCell>
                      <TableCell>
                        <Badge variant={hasCost ? "success" : "secondary"} className="text-[10px]">
                          {hasCost ? "Recorded" : "Missing"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
