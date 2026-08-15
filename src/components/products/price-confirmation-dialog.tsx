"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedProfit, calcEstimatedMargin } from "@/lib/utils/cost-conversion";

export type PriceConfirmationRow = {
  key: string;
  optionLabel: string;
  buyingPriceInr: number;
  importCostInr: number;
  finalCostBhd: number;
  suggestedPriceBhd: number;
  /** Present only in the edit-product flow — the price before this save, shown alongside
   *  the new one so staff can see exactly what's changing. */
  oldPriceBhd?: number;
};

type PriceConfirmationDialogProps = {
  open: boolean;
  rows: PriceConfirmationRow[];
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: (prices: Record<string, number>) => void;
  /** Defaults to the new-product wording. */
  title?: string;
  confirmLabel?: string;
  confirmPendingLabel?: string;
};

/** Seeds the editable-price map from each row's suggested price — falls back to the final
 *  cost when nothing was suggested (no valid cost yet), so the field is never left at 0 by
 *  surprise. */
function initialPrices(rows: PriceConfirmationRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.key, row.suggestedPriceBhd]));
}

export function PriceConfirmationDialog({
  open,
  rows,
  isSubmitting,
  onBack,
  onConfirm,
  title = "Confirm product prices",
  confirmLabel = "Create product",
  confirmPendingLabel = "Creating...",
}: PriceConfirmationDialogProps) {
  const [prices, setPrices] = useState<Record<string, number>>(() => initialPrices(rows));
  // Tracks the open/closed transition so prices can be re-seeded from fresh rows the moment
  // the dialog opens (e.g. staff went back to Step 3, changed a buying price, and reopened
  // the confirmation) — adjusting state during render instead of in an effect, per React's
  // guidance, avoids an extra render pass just to reset this.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPrices(initialPrices(rows));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onBack()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => {
            const price = prices[row.key] ?? row.suggestedPriceBhd;
            const profit = calcEstimatedProfit(price, row.finalCostBhd);
            const margin = calcEstimatedMargin(price, row.finalCostBhd);
            const belowCost = row.finalCostBhd > 0 && price > 0 && price < row.finalCostBhd;
            const totalIndiaCostInr = row.buyingPriceInr + row.importCostInr;

            return (
              <div key={row.key} className="rounded-md border border-musiva-border bg-white p-3">
                <p className="font-medium text-musiva-plum">{row.optionLabel}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                  <div className="flex justify-between gap-2 sm:block">
                    <span>Buying India</span>
                    <span className="font-medium text-foreground sm:block">
                      {formatInr(row.buyingPriceInr)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span>Import India</span>
                    <span className="font-medium text-foreground sm:block">
                      {formatInr(row.importCostInr)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span>Total India cost</span>
                    <span className="font-medium text-foreground sm:block">
                      {formatInr(totalIndiaCostInr)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span>Final cost Bahrain</span>
                    <span className="font-medium text-foreground sm:block">
                      {row.finalCostBhd > 0 ? formatBhd(row.finalCostBhd) : "Not recorded"}
                    </span>
                  </div>
                </div>

                {row.oldPriceBhd !== undefined && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Old selling price:{" "}
                    <span className="font-medium text-foreground">{formatBhd(row.oldPriceBhd)}</span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]" htmlFor={`price-${row.key}`}>
                      Selling price / Final customer price (BHD)
                    </Label>
                    <Input
                      className="h-9 w-32"
                      id={`price-${row.key}`}
                      min={0}
                      step="0.001"
                      type="number"
                      value={price || ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [row.key]: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  {row.suggestedPriceBhd > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Suggested: <span className="font-medium text-foreground">{formatBhd(row.suggestedPriceBhd)}</span>
                    </p>
                  )}
                  {row.finalCostBhd > 0 && price > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Profit: <span className="font-medium text-foreground">{formatBhd(profit)}</span>
                      {margin !== null ? ` · Margin ${margin.toFixed(1)}%` : ""}
                    </p>
                  )}
                </div>

                {belowCost && (
                  <p className="mt-2 rounded border border-musiva-warning/30 bg-musiva-warning/10 px-2 py-1 text-xs text-musiva-warning-foreground">
                    Selling price is below final cost.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onBack}>
            Back to edit
          </Button>
          <Button
            disabled={isSubmitting}
            type="button"
            onClick={() => onConfirm(prices)}
          >
            {isSubmitting ? confirmPendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
