"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { archiveProductAction, checkProductDeletableAction, deleteProductAction } from "@/app/admin/products/actions";

type CheckState =
  | { phase: "checking" }
  | { phase: "blocked"; blockers: string[] }
  | { phase: "allowed" };

type Props = {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
};

export function ProductDeleteDialog({ open, productId, productName, onClose }: Props) {
  const router = useRouter();
  const [check, setCheck] = useState<CheckState>({ phase: "checking" });
  const [confirmText, setConfirmText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isArchiving, startArchiveTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Run safety check every time dialog opens; reset state on close.
  useEffect(() => {
    if (!open) {
      setCheck({ phase: "checking" }); // eslint-disable-line react-hooks/set-state-in-effect
      setConfirmText("");
      setActionError(null);
      return;
    }

    let cancelled = false;
    setCheck({ phase: "checking" });

    checkProductDeletableAction(productId).then((result) => {
      if (cancelled) return;
      if (result.canDelete) {
        setCheck({ phase: "allowed" });
        // Focus the confirmation input after transition
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setCheck({ phase: "blocked", blockers: result.blockers });
      }
    });

    return () => { cancelled = true; };
  }, [open, productId]);

  function handleDelete() {
    if (confirmText !== "DELETE") return;
    setActionError(null);

    startDeleteTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        setActionError(result.error ?? "Delete failed. Please try again.");
        return;
      }
      onClose();
      router.push("/admin/products");
      router.refresh();
    });
  }

  const deleteEnabled = confirmText === "DELETE" && !isDeleting;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permanently delete product?</DialogTitle>
        </DialogHeader>

        {check.phase === "checking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Checking records…
          </div>
        )}

        {check.phase === "blocked" && (
          <div className="space-y-3">
            <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-medium text-musiva-plum">Cannot delete this product</p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium">{productName}</span> has {check.blockers.join(", ")} and
                  cannot be permanently deleted. Archive it instead to hide it from new sales while
                  keeping all history safe.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isArchiving}>
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={isArchiving}
                onClick={() => {
                  startArchiveTransition(async () => {
                    await archiveProductAction(productId);
                    onClose();
                    router.refresh();
                  });
                }}
              >
                {isArchiving && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
                Archive instead
              </Button>
            </DialogFooter>
          </div>
        )}

        {check.phase === "allowed" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This is only allowed because{" "}
              <span className="font-medium text-musiva-plum">{productName}</span> has no business
              history. This action cannot be undone — the product, its variants, and its image will
              be permanently removed.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-semibold tracking-wide text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                ref={inputRef}
                id="confirm-delete"
                autoComplete="off"
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && deleteEnabled && handleDelete()}
              />
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!deleteEnabled}
                onClick={handleDelete}
              >
                {isDeleting && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
                Delete permanently
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
