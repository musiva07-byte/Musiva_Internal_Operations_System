"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receivePurchaseAction } from "@/app/admin/purchases/actions";

/**
 * Marks a purchase order received. Previously a plain `<form action={...}>` calling the
 * server action directly with no feedback — a failure (e.g. an RPC rejection) or a success
 * both looked identical to staff: the page just reloaded. Same inline success/error pattern
 * as WebsiteRequestStatusActions.
 */
export function MarkReceivedButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await receivePurchaseAction(purchaseId);
      if (!result.ok) {
        setError(result.error ?? "Purchase could not be marked received. Please try again.");
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" disabled={isPending} onClick={handleClick}>
        {isPending ? (
          <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 aria-hidden className="mr-2 h-4 w-4" />
        )}
        {isPending ? "Marking received..." : "Mark received"}
      </Button>
      {success && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-musiva-sage">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Purchase marked received. Stock has been updated.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
