"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr, calcEstimatedProfit, calcEstimatedMargin } from "@/lib/utils/cost-conversion";
import { titleize } from "@/lib/formatters/labels";
import type { ProductOnlineStatus } from "@/types/database";

export type PriceConfirmationRow = {
  key: string;
  optionLabel: string;
  buyingPriceInr: number;
  importCostInr: number;
  finalCostBhd: number;
  suggestedPriceBhd: number;
  /** The price already sitting in the form for this variant — for an untouched existing
   *  variant this is exactly the stored price. This dialog's editable field is seeded from
   *  THIS, never from suggestedPriceBhd — seeding from the cost-derived suggestion instead of
   *  the real current price was a real incident: staff editing unrelated product details (e.g.
   *  website status) had their customer-facing selling price silently replaced by a
   *  zero-profit cost figure the moment they saved, because this dialog defaulted every price
   *  field to "cost + whatever profit happened to be typed" (usually 0) instead of what the
   *  product was actually selling for. */
  currentPriceBhd: number;
  /** Present only in the edit-product flow — the true price before this save (from the
   *  database), shown alongside the new one so staff can see exactly what's changing. */
  oldPriceBhd?: number;
};

/** Present only in the edit-product flow, and only when the website status actually
 *  changed — shown as a small summary so staff notice a publish/unpublish alongside the
 *  price changes rather than only finding out from the catalog afterward. */
export type WebsiteStatusChange = {
  oldStatus: ProductOnlineStatus;
  newStatus: ProductOnlineStatus;
  oldVisible: boolean;
  newVisible: boolean;
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
  /** Shown under the title so staff can confirm which product this review is for. */
  productName?: string;
  websiteStatusChange?: WebsiteStatusChange | null;
};

/** Seeds the editable-price map from each row's CURRENT price (what's already in the form —
 *  the real stored price for an untouched variant) — never from the cost-derived suggested
 *  price. A brand-new variant (no current price yet) falls back to the suggested price so the
 *  field isn't left at 0 by surprise; an existing variant always starts at its real price. See
 *  PriceConfirmationRow.currentPriceBhd for the incident this fixes. */
function initialPrices(rows: PriceConfirmationRow[]): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [row.key, row.currentPriceBhd > 0 ? row.currentPriceBhd : row.suggestedPriceBhd]),
  );
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
  productName,
  websiteStatusChange,
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
          {productName ? <DialogDescription>{productName}</DialogDescription> : null}
        </DialogHeader>

        {websiteStatusChange ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-musiva-plum">Website status changing:</span>
            <Badge variant="secondary">{titleize(websiteStatusChange.oldStatus)}</Badge>
            <span>→</span>
            <Badge
              variant={
                websiteStatusChange.newStatus === "published"
                  ? "success"
                  : websiteStatusChange.newStatus === "draft"
                  ? "warning"
                  : "secondary"
              }
            >
              {titleize(websiteStatusChange.newStatus)}
            </Badge>
            <span>
              ({websiteStatusChange.oldVisible ? "was visible" : "was hidden"} →{" "}
              {websiteStatusChange.newVisible ? "now visible" : "now hidden"} on website)
            </span>
          </div>
        ) : null}

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => {
            const price = prices[row.key] ?? row.currentPriceBhd;
            const profit = calcEstimatedProfit(price, row.finalCostBhd);
            const margin = calcEstimatedMargin(price, row.finalCostBhd);
            const belowCost = row.finalCostBhd > 0 && price > 0 && price < row.finalCostBhd;
            const totalIndiaCostInr = row.buyingPriceInr + row.importCostInr;
            const isNewVariant = row.oldPriceBhd === undefined;
            const priceChanged = row.oldPriceBhd !== undefined && row.oldPriceBhd !== price;
            const suggestionDiffersFromPrice = row.suggestedPriceBhd > 0 && row.suggestedPriceBhd !== price;

            return (
              <div key={row.key} className="rounded-md border border-musiva-border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-musiva-plum">{row.optionLabel}</p>
                  {isNewVariant ? (
                    <Badge className="text-[10px]" variant="secondary">New option</Badge>
                  ) : priceChanged ? (
                    <Badge className="text-[10px]" variant="warning">Changed</Badge>
                  ) : null}
                </div>
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

                {!isNewVariant && !priceChanged && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-musiva-sage">
                    Selling price unchanged at {formatBhd(price)} — cost changes never affect
                    customer price automatically.
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Suggested: <span className="font-medium text-foreground">{formatBhd(row.suggestedPriceBhd)}</span>
                      </p>
                      {suggestionDiffersFromPrice && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            setPrices((prev) => ({ ...prev, [row.key]: row.suggestedPriceBhd }))
                          }
                        >
                          Use suggested price
                        </Button>
                      )}
                    </div>
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
