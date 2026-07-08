"use client";

import { useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addStockAction } from "@/app/admin/inventory/actions";
import {
  RECEIVE_STOCK_REASON_LABELS,
  RECEIVE_STOCK_REASONS,
  reasonToMovementType,
  type ReceiveStockReason,
} from "@/lib/utils/stock-reason";

type VariantOption = {
  id: string;
  color: string;
  size: string;
  stock_quantity: number;
};

type QuickAddStockDialogProps = {
  productName: string;
  variants: VariantOption[];
  onSuccess?: () => void;
};

export function QuickAddStockDialog({
  productName,
  variants,
  onSuccess,
}: QuickAddStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ReceiveStockReason>(
    RECEIVE_STOCK_REASONS.supplierDelivery,
  );
  const [note, setNote] = useState("");

  const selectedVariant = variants.find((v) => v.id === variantId);

  function reset() {
    setVariantId(variants[0]?.id ?? "");
    setQuantity(1);
    setReason(RECEIVE_STOCK_REASONS.supplierDelivery);
    setNote("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId) {
      setError("Please select a size/color option.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await addStockAction({
        productVariantId: variantId,
        quantity,
        movementType: reasonToMovementType(reason),
        referenceType: null,
        referenceId: null,
        note: note.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? "Stock could not be added. Please try again.");
        return;
      }

      reset();
      setOpen(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
          type="button"
        >
          <PackagePlus aria-hidden className="h-4 w-4" />
          Add stock
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add stock</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="qs-variant">Size / color option</Label>
            <Select
              id="qs-variant"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.color} / {v.size} (stock: {v.stock_quantity})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-qty">Quantity received</Label>
            <Input
              id="qs-qty"
              min={1}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
            {selectedVariant ? (
              <p className="text-xs text-muted-foreground">
                Current: {selectedVariant.stock_quantity} → After: {selectedVariant.stock_quantity + quantity}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-reason">Reason</Label>
            <Select
              id="qs-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReceiveStockReason)}
            >
              {Object.entries(RECEIVE_STOCK_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-note">Note (optional)</Label>
            <Textarea
              id="qs-note"
              placeholder="e.g. Received from supplier"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || !variantId} type="submit">
              {isPending ? "Adding…" : `Add ${quantity} unit${quantity !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
