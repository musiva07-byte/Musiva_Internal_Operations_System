"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adjustStockAction } from "@/app/admin/inventory/actions";
import {
  STOCK_CORRECTION_REASONS,
  STOCK_CORRECTION_REASON_LABELS,
  buildCorrectionNote,
  type StockCorrectionReason,
} from "@/lib/utils/stock-reason";

type CorrectQuantityModalProps = {
  productName: string;
  variantId: string;
  color: string;
  size: string;
  currentStock: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful correction so the caller can router.refresh() the page. */
  onSuccess: () => void;
};

const FRIENDLY_ERROR = "Could not update stock. Please try again or contact the administrator.";

/**
 * Single-variant "Correct quantity" action for Edit Product. Uses the same adjustStockAction()
 * / adjust_variant_stock RPC as the standalone Correct Quantity page — stock is never written
 * without a stock_movements row recording the before/after quantities.
 */
export function CorrectQuantityModal({
  productName,
  variantId,
  color,
  size,
  currentStock,
  open,
  onOpenChange,
  onSuccess,
}: CorrectQuantityModalProps) {
  const [isPending, startTransition] = useTransition();
  const [newQuantity, setNewQuantity] = useState(currentStock);
  const [reason, setReason] = useState<StockCorrectionReason>(STOCK_CORRECTION_REASONS.stockCount);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ newStock: number } | null>(null);

  const delta = newQuantity - currentStock;

  function reset() {
    setNewQuantity(currentStock);
    setReason(STOCK_CORRECTION_REASONS.stockCount);
    setNote("");
    setError(null);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function handleSubmit() {
    if (newQuantity < 0) {
      setError("Quantity cannot be negative.");
      return;
    }
    if (newQuantity === currentStock) {
      setError("Enter a quantity different from the current stock.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const response = await adjustStockAction({
        productVariantId: variantId,
        newQuantity,
        note: buildCorrectionNote(reason, note),
        referenceType: "manual_adjustment",
        referenceId: null,
      });

      if (!response.ok) {
        console.error("[CorrectQuantityModal] adjustStockAction failed:", response.error);
        setError(FRIENDLY_ERROR);
        return;
      }

      setResult({ newStock: newQuantity });
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Correct stock quantity</DialogTitle>
          <DialogDescription>
            {productName} — {color} / {size}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-musiva-sage/25 bg-musiva-sage/10 p-3">
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-musiva-sage" />
              <p className="text-sm text-foreground">
                Stock quantity corrected successfully. New stock: {result.newStock} unit
                {result.newStock !== 1 ? "s" : ""}.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Deliberately a <div>, not a <form> — see ReceiveStockModal for why: this dialog
          // is rendered inside Edit Product's own <form>, and React bubbles a nested form's
          // submit event through the *React* tree even across a Dialog portal.
          <div className="space-y-4">
            <div className="rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-sm">
              <p className="text-muted-foreground">Current stock</p>
              <p className="font-medium text-foreground">
                {currentStock} unit{currentStock !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correct-qty">Correct quantity</Label>
              <Input
                id="correct-qty"
                min={0}
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correct-reason">Reason</Label>
              <Select
                id="correct-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as StockCorrectionReason)}
              >
                {Object.entries(STOCK_CORRECTION_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correct-note">Note (optional)</Label>
              <Textarea
                id="correct-note"
                placeholder="e.g. Recounted during weekly stocktake"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Adjustment:{" "}
              <span className="font-medium text-foreground">
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} unit${Math.abs(delta) !== 1 ? "s" : ""}`}
              </span>
            </p>

            {error ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={isPending || newQuantity === currentStock || newQuantity < 0}
                type="button"
                onClick={handleSubmit}
              >
                {isPending ? (
                  "Saving..."
                ) : (
                  <>
                    <SlidersHorizontal aria-hidden className="mr-2 h-4 w-4" />
                    Save correction
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
