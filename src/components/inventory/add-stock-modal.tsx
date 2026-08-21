"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { addStockAction } from "@/app/admin/inventory/actions";
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import type { InventoryVariantItem } from "@/types/app";

type AddStockModalProps = {
  variant: Pick<
    InventoryVariantItem,
    "id" | "product_name" | "product_sku" | "color" | "size" | "variant_sku" | "stock_quantity" | "minimum_stock"
  >;
};

const NOTE_MAX_LENGTH = 500;
const FRIENDLY_ERROR = "Could not add stock. Please try again or contact the administrator.";

/**
 * Stock Management's row-level "Add stock" action — opens directly on the exact variant the
 * row is already showing, instead of redirecting to /admin/inventory/stock-entry and making
 * staff search for the same product again. Uses the same addStockAction() / add_variant_stock
 * RPC as every other receive-stock entry point (Receive Stock page, Edit Product's Receive
 * stock button), so stock is never written without a stock_movements row — see
 * inventory-stock-actions.test.ts for that shared guarantee. The Receive Stock page itself is
 * untouched and still works for the general search-first workflow.
 */
export function AddStockModal({ variant }: AddStockModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ newStock: number } | null>(null);

  const isQuantityValid = Number.isInteger(quantity) && quantity > 0;
  const newStockPreview = variant.stock_quantity + (Number.isFinite(quantity) ? quantity : 0);

  function reset() {
    setQuantity(1);
    setNote("");
    setQuantityError(null);
    setError(null);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleQuantityChange(raw: string) {
    const parsed = Number(raw);
    setQuantity(parsed);
    if (raw.trim() === "") {
      setQuantityError("Enter a quantity.");
    } else if (!Number.isInteger(parsed)) {
      setQuantityError("Quantity must be a whole number.");
    } else if (parsed <= 0) {
      setQuantityError("Quantity must be greater than 0.");
    } else {
      setQuantityError(null);
    }
  }

  function handleSubmit() {
    if (!isQuantityValid) {
      setQuantityError(quantity <= 0 ? "Quantity must be greater than 0." : "Quantity must be a whole number.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const response = await addStockAction({
        productVariantId: variant.id,
        quantity,
        movementType: STOCK_MOVEMENT_TYPES.purchaseStock,
        referenceType: null,
        referenceId: null,
        note: note.trim() || null,
      });

      if (!response.ok) {
        console.error("[AddStockModal] addStockAction failed:", response.error);
        setError(FRIENDLY_ERROR);
        return;
      }

      setResult({ newStock: newStockPreview });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" title="Add stock" type="button" variant="outline">
          <PackagePlus aria-hidden className="h-4 w-4" />
          <span className="sr-only">Add stock</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add stock</DialogTitle>
          <DialogDescription>
            {variant.product_name} — {variant.color} / {variant.size}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-musiva-sage/25 bg-musiva-sage/10 p-3">
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-musiva-sage" />
              <p className="text-sm text-foreground">
                Stock added successfully. New stock: {result.newStock} unit{result.newStock !== 1 ? "s" : ""}.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Deliberately a <div>, not a <form> — matches every other action dialog in this
          // codebase (ProductArchiveDialog, ReceiveStockModal, CorrectQuantityModal, ...), a
          // convention that exists specifically because a nested <form>'s submit event
          // bubbles up through the *React* component tree (not the DOM tree) even across a
          // Dialog's portal, which can trigger an unrelated ancestor form's onSubmit.
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-sm">
              <div>
                <p className="text-muted-foreground">Product code / SKU</p>
                <p className="font-medium text-foreground">{variant.product_sku}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Variant SKU / code</p>
                <p className="font-medium text-foreground">{variant.variant_sku}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current stock</p>
                <p className="font-medium text-foreground">
                  {variant.stock_quantity} unit{variant.stock_quantity !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Minimum stock</p>
                <p className="font-medium text-foreground">{variant.minimum_stock}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-stock-qty">Quantity to add</Label>
              <Input
                id="add-stock-qty"
                min={1}
                step={1}
                type="number"
                value={Number.isNaN(quantity) ? "" : quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
              />
              {quantityError ? <p className="text-xs text-destructive">{quantityError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-stock-note">Note (optional)</Label>
              <Textarea
                id="add-stock-note"
                maxLength={NOTE_MAX_LENGTH}
                placeholder="e.g. Received from supplier"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              New stock:{" "}
              <span className="font-medium text-foreground">{isQuantityValid ? newStockPreview : "—"}</span>
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
              <Button disabled={isPending || !isQuantityValid} type="button" onClick={handleSubmit}>
                {isPending ? (
                  "Adding..."
                ) : (
                  <>
                    <PackagePlus aria-hidden className="mr-2 h-4 w-4" />
                    Add stock
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
