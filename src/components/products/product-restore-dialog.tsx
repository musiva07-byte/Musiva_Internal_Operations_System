"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { restoreProductAction } from "@/app/admin/products/actions";

type Props = {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function ProductRestoreDialog({ open, productId, productName, onClose, onSuccess }: Props) {
  const [targetStatus, setTargetStatus] = useState<"active" | "inactive">("active");
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreProductAction(productId, targetStatus);
      if (result.ok) {
        onSuccess();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restore product?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-musiva-plum">{productName}</span> will be restored and
          made available again in sales and stock management.
        </p>
        <div className="space-y-2">
          <Label htmlFor="restore-status">Restore as</Label>
          <Select
            id="restore-status"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as "active" | "inactive")}
          >
            <option value="active">Active — visible in sales and inventory</option>
            <option value="inactive">Inactive — restored but not shown in sales</option>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={isPending}>
            {isPending && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
            Restore product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
