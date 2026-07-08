"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveProductAction } from "@/app/admin/products/actions";

type Props = {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function ProductArchiveDialog({ open, productId, productName, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveProductAction(productId);
      if (result.ok) {
        onSuccess();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive product?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-musiva-plum">{productName}</span> will no longer appear
          in new sales or normal stock selection, but previous orders and stock history will remain
          safe. You can restore it at any time.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={isPending}>
            {isPending && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
            Archive product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
