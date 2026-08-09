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
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedProfit, calcEstimatedMargin } from "@/lib/utils/cost-conversion";
import type { BuyingCostStatus } from "@/lib/utils/cost-conversion";

type Props = {
  productName: string;
  color: string;
  size: string;
  stockQuantity: number;
  costStatus: BuyingCostStatus;
  buyingPriceInr: number | null;
  exchangeRateToBhd: number | null;
  convertedUnitCostBhd: number | null;
  /** Import cost per piece (BHD). Shown even when exactly 0. */
  importCostBhd: number | null;
  finalUnitCostBhd: number | null;
  sellingPriceBhd: number;
  /** Owner/manager/accountant only — gates profit per piece and margin. */
  showProfit: boolean;
  /** Small "View cost" link/button vs. "Review cost" for an invalid record. Defaults to "View cost". */
  triggerLabel?: string;
};

export function BuyingCostDialog({
  productName,
  color,
  size,
  stockQuantity,
  costStatus,
  buyingPriceInr,
  exchangeRateToBhd,
  convertedUnitCostBhd,
  importCostBhd,
  finalUnitCostBhd,
  sellingPriceBhd,
  showProfit,
  triggerLabel = "View cost",
}: Props) {
  const [open, setOpen] = useState(false);

  const hasFullCost =
    costStatus === "recorded" &&
    buyingPriceInr !== null &&
    finalUnitCostBhd !== null &&
    convertedUnitCostBhd !== null;

  const profit =
    showProfit && hasFullCost ? calcEstimatedProfit(sellingPriceBhd, finalUnitCostBhd!) : null;
  const margin =
    showProfit && hasFullCost ? calcEstimatedMargin(sellingPriceBhd, finalUnitCostBhd!) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-xs font-medium text-musiva-plum hover:underline"
          type="button"
        >
          <DollarSign aria-hidden className="h-3 w-3" />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Buying Cost Details</DialogTitle>
          <DialogDescription>
            {productName} — {color} / {size}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Stock quantity</span>
            <span className="font-medium text-foreground">{stockQuantity}</span>
          </div>

          {costStatus === "missing" && (
            <p className="rounded-md bg-musiva-ivory px-3 py-2 text-muted-foreground">
              Buying cost not recorded yet.
            </p>
          )}

          {costStatus === "invalid" && (
            <div className="space-y-2">
              <p className="rounded-md bg-musiva-warning/10 px-3 py-2 text-musiva-warning-foreground">
                Buying cost data is incomplete. Both an INR buying price and an exchange rate
                are required before a final cost can be calculated.
              </p>
              {buyingPriceInr !== null && buyingPriceInr > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Buying price India</span>
                  <span className="font-medium text-foreground">{formatInr(buyingPriceInr)}</span>
                </div>
              )}
              {exchangeRateToBhd !== null && exchangeRateToBhd > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Exchange rate</span>
                  <span className="font-medium text-foreground">
                    1 INR = BHD {exchangeRateToBhd.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          )}

          {hasFullCost && (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Buying price India</span>
                <span className="font-medium text-foreground">{formatInr(buyingPriceInr!)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Exchange rate</span>
                <span className="font-medium text-foreground">
                  1 INR = BHD {exchangeRateToBhd!.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[hsl(var(--border))] pt-3">
                <span className="text-muted-foreground">Converted buying cost</span>
                <span className="font-medium text-foreground">
                  {formatBhd(convertedUnitCostBhd!)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Import cost per piece</span>
                <span className="font-medium text-foreground">
                  {formatBhd(importCostBhd ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[hsl(var(--border))] pt-3">
                <span className="font-medium text-musiva-plum">Final cost per piece</span>
                <span className="font-semibold text-musiva-plum">
                  {formatBhd(finalUnitCostBhd!)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[hsl(var(--border))] pt-3">
                <span className="text-muted-foreground">Total buying value India</span>
                <span className="font-medium text-foreground">
                  {formatInr(buyingPriceInr! * stockQuantity)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Total final cost Bahrain</span>
                <span className="font-medium text-foreground">
                  {formatBhd(finalUnitCostBhd! * stockQuantity)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[hsl(var(--border))] pt-3">
                <span className="text-muted-foreground">Selling price</span>
                <span className="font-medium text-foreground">{formatBhd(sellingPriceBhd)}</span>
              </div>

              {showProfit && profit !== null && (
                <div className="flex justify-between gap-4 border-t border-[hsl(var(--border))] pt-3">
                  <span className="text-muted-foreground">Profit per piece</span>
                  <span className="font-medium text-foreground">{formatBhd(profit)}</span>
                </div>
              )}
              {showProfit && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-medium text-foreground">
                    {margin !== null ? `${margin.toFixed(2)}%` : "—"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
