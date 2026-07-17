"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { titleize } from "@/lib/formatters/labels";
import { buildWebsiteRequestFollowUpMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { updateWebsiteRequestStatusAction } from "@/app/admin/website-requests/actions";
import type { WebsiteOrderRequestStatus } from "@/types/database";

const NEXT_STATUS_LABELS: Partial<Record<WebsiteOrderRequestStatus, string>> = {
  contacted: "Mark contacted",
  confirmed: "Confirm request",
  cancelled: "Cancel request",
  new: "Reopen request",
};

type Props = {
  requestId: string;
  customerName: string;
  requestNumber: string;
  whatsappNormalized: string;
  allowedNextStatuses: WebsiteOrderRequestStatus[];
};

export function WebsiteRequestStatusActions({
  requestId,
  customerName,
  requestNumber,
  whatsappNormalized,
  allowedNextStatuses,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<WebsiteOrderRequestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(target: WebsiteOrderRequestStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateWebsiteRequestStatusAction(requestId, target);
      if (!result.ok) {
        setError(result.error ?? "Status could not be updated.");
        return;
      }
      setConfirmTarget(null);
      router.refresh();
    });
  }

  function handleClick(target: WebsiteOrderRequestStatus) {
    // Cancelling is the one hard-to-reverse action here — confirm before submitting.
    if (target === "cancelled") {
      setConfirmTarget(target);
      return;
    }
    submit(target);
  }

  const followUpUrl = buildWhatsAppUrl(
    whatsappNormalized,
    buildWebsiteRequestFollowUpMessage({ customerName, requestNumber }),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={followUpUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden className="mr-2 h-4 w-4" />
            Open WhatsApp
          </a>
        </Button>

        {allowedNextStatuses.map((status) => (
          <Button
            key={status}
            variant={status === "cancelled" ? "destructive" : "outline"}
            disabled={isPending}
            onClick={() => handleClick(status)}
          >
            {isPending && confirmTarget === null ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {NEXT_STATUS_LABELS[status] ?? `Mark ${titleize(status)}`}
          </Button>
        ))}
      </div>

      {confirmTarget === "cancelled" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">Cancel this request?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This tells staff the request will not be fulfilled. This can be undone later by an
            owner if needed.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => submit("cancelled")}
            >
              {isPending ? <Loader2 aria-hidden className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm cancel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmTarget(null)}
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
