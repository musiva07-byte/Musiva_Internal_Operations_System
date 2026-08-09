"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateProductOnlineStatusAction } from "@/app/admin/products/actions";
import { titleize } from "@/lib/formatters/labels";
import type { ProductOnlineStatus } from "@/types/database";

type Props = {
  productId: string;
  productName: string;
  onlineStatus: ProductOnlineStatus;
  /** Same readiness check used to gate publishing server-side (getPublishingReadiness). */
  websiteReady: boolean;
  /** Only owner/manager (canPublishProducts) get the actionable control — everyone else
   *  sees a plain read-only badge, and the server enforces the same rule independently. */
  canPublish: boolean;
};

const STATUS_VARIANT: Record<ProductOnlineStatus, "success" | "warning" | "secondary"> = {
  published: "success",
  draft: "warning",
  hidden: "secondary",
};

const OPTIONS: {
  key: ProductOnlineStatus;
  label: string;
  next: { onlineStatus: ProductOnlineStatus; websiteVisible: boolean };
}[] = [
  { key: "published", label: "Publish on website", next: { onlineStatus: "published", websiteVisible: true } },
  { key: "hidden", label: "Hide from website", next: { onlineStatus: "hidden", websiteVisible: false } },
  { key: "draft", label: "Set as draft", next: { onlineStatus: "draft", websiteVisible: false } },
];

export function WebsiteStatusControl({
  productId,
  productName,
  onlineStatus,
  websiteReady,
  canPublish,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canPublish) {
    return <Badge variant={STATUS_VARIANT[onlineStatus]}>Website: {titleize(onlineStatus)}</Badge>;
  }

  function apply(next: { onlineStatus: ProductOnlineStatus; websiteVisible: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await updateProductOnlineStatusAction(productId, next);
      if (!result.ok) {
        setError(
          result.error ??
            "This product is not ready to publish. Complete the website details first.",
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Badge variant={STATUS_VARIANT[onlineStatus]}>Website: {titleize(onlineStatus)}</Badge>
        <ChevronDown aria-hidden className="h-3 w-3 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Website status</DialogTitle>
            <DialogDescription>{productName}</DialogDescription>
          </DialogHeader>

          {!websiteReady && (
            <p className="rounded-md border border-musiva-warning/25 bg-musiva-warning/10 px-3 py-2 text-sm text-musiva-warning-foreground">
              This product is not ready to publish. Complete the website details first.
            </p>
          )}

          <div className="space-y-2">
            {OPTIONS.map((option) => (
              <Button
                key={option.key}
                className="w-full justify-start"
                disabled={isPending || onlineStatus === option.key}
                type="button"
                variant={onlineStatus === option.key ? "default" : "outline"}
                onClick={() => apply(option.next)}
              >
                {isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
                {option.label}
                {onlineStatus === option.key ? " (current)" : ""}
              </Button>
            ))}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
