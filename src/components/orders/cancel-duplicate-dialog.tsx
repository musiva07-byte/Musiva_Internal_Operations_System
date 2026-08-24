"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
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
import { cancelOrderWithReasonAction } from "@/app/admin/orders/actions";

const FRIENDLY_ERROR = "Could not cancel this order. Please try again or contact the administrator.";

type CancelDuplicateDialogProps = {
  orderId: string;
  orderNumber: string;
};

/**
 * "Cancel / Mark duplicate" — the safe cleanup action for a wrong order (e.g. one replaced by
 * a size/color correction). Unlike the quick one-click cancel on the orders list, this works
 * on completed/paid orders too (server enforces owner/manager for those), always requires a
 * reason, and lets staff choose whether to return items to stock. The order is never deleted —
 * it stays in history as "cancelled".
 */
export function CancelDuplicateDialog({ orderId, orderNumber }: CancelDuplicateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [linkedOrderNumber, setLinkedOrderNumber] = useState("");
  const [returnStock, setReturnStock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason("");
      setLinkedOrderNumber("");
      setReturnStock(true);
      setError(null);
    }
  }

  function handleSubmit() {
    if (reason.trim().length < 3) {
      setError("Please provide a reason (at least 3 characters).");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await cancelOrderWithReasonAction(orderId, {
        reason: reason.trim(),
        linkedOrderNumber: linkedOrderNumber.trim() || undefined,
        returnStock,
      });

      if (!result.ok) {
        console.error("[CancelDuplicateDialog] cancelOrderWithReasonAction failed:", result.error);
        setError(result.error ?? FRIENDLY_ERROR);
        return;
      }

      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        <Ban aria-hidden className="mr-2 h-4 w-4" />
        Cancel / Mark duplicate
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {orderNumber}</DialogTitle>
            <DialogDescription>
              The order stays in history as cancelled — it is never deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="e.g. Customer changed size; correct order created as MSV-10012."
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel-linked-order">Correct order number (optional)</Label>
              <Input
                id="cancel-linked-order"
                placeholder="e.g. MSV-10012"
                value={linkedOrderNumber}
                onChange={(e) => setLinkedOrderNumber(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={returnStock}
                onChange={(e) => setReturnStock(e.target.checked)}
                className="h-4 w-4 rounded border-musiva-border accent-[var(--brand-mauve)]"
              />
              Return items to stock
            </label>

            {error ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Back
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Cancelling..." : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
