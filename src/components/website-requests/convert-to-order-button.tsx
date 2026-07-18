"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters/date";
import { getConvertToOrderViewState } from "@/lib/utils/website-request-ui";
import { convertWebsiteRequestToOrderAction } from "@/app/admin/website-requests/actions";
import type { WebsiteOrderRequestStatus } from "@/types/database";

type Props = {
  requestId: string;
  status: WebsiteOrderRequestStatus;
  canConvert: boolean;
  /** Non-null when this request has already been converted (from the DB, not local state). */
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
  convertedAt: string | null;
};

export function ConvertToOrderButton({
  requestId,
  status,
  canConvert,
  convertedOrderId,
  convertedOrderNumber,
  convertedAt,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: string; orderNumber: string } | null>(null);

  // Already converted — either from a fresh page load or from this component's own
  // just-completed action. Show the result, never a button.
  const orderId = success?.orderId ?? convertedOrderId;
  const orderNumber = success?.orderNumber ?? convertedOrderNumber;
  const viewState = getConvertToOrderViewState(status, canConvert, orderId);

  if (viewState === "converted") {
    return (
      <div className="space-y-2 border-t border-[hsl(var(--border))] pt-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-musiva-sage">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Converted to order {orderNumber}
        </p>
        {convertedAt && !success && (
          <p className="text-xs text-muted-foreground">Converted {formatDateTime(convertedAt)}</p>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/orders/${orderId}`}>View order</Link>
        </Button>
      </div>
    );
  }

  if (viewState === "cancelled" || viewState === "no_permission") {
    return null;
  }

  if (viewState === "needs_confirmation") {
    return (
      <p className="border-t border-[hsl(var(--border))] pt-3 text-xs text-muted-foreground">
        Confirm this request before converting it to an order.
      </p>
    );
  }

  function handleConvert() {
    setError(null);
    startTransition(async () => {
      const result = await convertWebsiteRequestToOrderAction(requestId);
      if (!result.ok || !result.orderId || !result.orderNumber) {
        setError(result.error ?? "This request could not be converted to an order.");
        setConfirming(false);
        return;
      }
      setSuccess({ orderId: result.orderId, orderNumber: result.orderNumber });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-[hsl(var(--border))] pt-3">
      {!confirming ? (
        <Button size="sm" onClick={() => setConfirming(true)}>
          <PackageCheck aria-hidden className="mr-2 h-4 w-4" />
          Convert to Order
        </Button>
      ) : (
        <div className="rounded-md border border-musiva-border bg-musiva-ivory p-3">
          <p className="text-sm font-medium text-musiva-plum">Convert this request to an order?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This creates a real order and deducts stock. This is the only point where stock is
            deducted for a website request.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={isPending} onClick={handleConvert}>
              {isPending ? <Loader2 aria-hidden className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm conversion
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
