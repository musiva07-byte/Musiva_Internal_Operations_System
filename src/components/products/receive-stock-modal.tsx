"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addStockAction } from "@/app/admin/inventory/actions";
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";

type ReceiveStockModalProps = {
  productName: string;
  variantId: string;
  color: string;
  size: string;
  currentStock: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful receive so the caller can router.refresh() the page. */
  onSuccess: () => void;
};

const FRIENDLY_ERROR = "Could not update stock. Please try again or contact the administrator.";

/**
 * Single-variant "Receive stock" action for Edit Product — scoped to one already-saved
 * variant (unlike QuickAddStockDialog's product-wide picker used from the Catalog row
 * actions). Uses the same addStockAction() / add_variant_stock RPC as every other receive-
 * stock entry point in the app, so stock is never written without a stock_movements row.
 */
export function ReceiveStockModal({
  productName,
  variantId,
  color,
  size,
  currentStock,
  open,
  onOpenChange,
  onSuccess,
}: ReceiveStockModalProps) {
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ newStock: number } | null>(null);

  const newStockPreview = currentStock + (Number.isFinite(quantity) ? quantity : 0);

  function reset() {
    setQuantity(1);
    setNote("");
    setError(null);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function handleSubmit() {
    if (quantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const response = await addStockAction({
        productVariantId: variantId,
        quantity,
        movementType: STOCK_MOVEMENT_TYPES.purchaseStock,
        referenceType: null,
        referenceId: null,
        note: note.trim() || null,
      });

      if (!response.ok) {
        console.error("[ReceiveStockModal] addStockAction failed:", response.error);
        setError(FRIENDLY_ERROR);
        return;
      }

      setResult({ newStock: newStockPreview });
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            {productName} — {color} / {size}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-musiva-sage/25 bg-musiva-sage/10 p-3">
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-musiva-sage" />
              <p className="text-sm text-foreground">
                Stock received successfully. New stock: {result.newStock} unit{result.newStock !== 1 ? "s" : ""}.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Deliberately a <div>, not a <form> — this dialog is rendered inside Edit
          // Product's own <form>. React bubbles a nested <form>'s submit event up through
          // the *React* component tree (not the DOM tree), even across a Dialog's portal —
          // a real bug caught in manual testing: submitting here also fired the outer
          // form's onSubmit and opened its price-confirmation popup. Plain onClick avoids
          // the whole class of bug, matching every other action dialog in this codebase
          // (ProductArchiveDialog, ProductDeleteDialog, ...).
          <div className="space-y-4">
            <div className="rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-sm">
              <p className="text-muted-foreground">Current stock</p>
              <p className="font-medium text-foreground">
                {currentStock} unit{currentStock !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-qty">Quantity to add</Label>
              <Input
                id="receive-qty"
                min={1}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-note">Note (optional)</Label>
              <Textarea
                id="receive-note"
                placeholder="e.g. Received from supplier"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              New stock: <span className="font-medium text-foreground">{newStockPreview}</span>
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
              <Button disabled={isPending || quantity <= 0} type="button" onClick={handleSubmit}>
                {isPending ? (
                  "Receiving..."
                ) : (
                  <>
                    <PackagePlus aria-hidden className="mr-2 h-4 w-4" />
                    Receive stock
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
