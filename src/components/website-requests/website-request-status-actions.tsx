"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { titleize } from "@/lib/formatters/labels";
import { buildWebsiteRequestFollowUpMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import {
  getStatusHelperNote,
  getVisibleNextStatuses,
  requiresConfirmation,
  showConvertToOrderPlaceholder,
} from "@/lib/utils/website-request-ui";
import { updateWebsiteRequestStatusAction } from "@/app/admin/website-requests/actions";
import type { StaffRole } from "@/lib/constants";
import type { WebsiteOrderRequestStatus } from "@/types/database";

const NEXT_STATUS_LABELS: Partial<Record<WebsiteOrderRequestStatus, string>> = {
  contacted: "Mark Contacted",
  confirmed: "Confirm",
  cancelled: "Cancel",
  new: "Reopen",
};

const SUCCESS_MESSAGES: Partial<Record<WebsiteOrderRequestStatus, string>> = {
  contacted: "Marked as contacted.",
  confirmed: "Request confirmed.",
  cancelled: "Request cancelled.",
  new: "Request reopened.",
};

type Props = {
  requestId: string;
  customerName: string;
  requestNumber: string;
  whatsappNormalized: string;
  status: WebsiteOrderRequestStatus;
  allowedNextStatuses: WebsiteOrderRequestStatus[];
  role: StaffRole | null | undefined;
  /** Card queue rows use a tighter, "sm" button size; the detail page uses the default size. */
  size?: "sm" | "default";
};

export function WebsiteRequestStatusActions({
  requestId,
  customerName,
  requestNumber,
  whatsappNormalized,
  status,
  allowedNextStatuses,
  role,
  size = "default",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<WebsiteOrderRequestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visibleNextStatuses = getVisibleNextStatuses(status, allowedNextStatuses);
  const helperNote = getStatusHelperNote(status, role);
  const showConvertPlaceholder = showConvertToOrderPlaceholder(status, role);

  function submit(target: WebsiteOrderRequestStatus) {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await updateWebsiteRequestStatusAction(requestId, target);
      if (!result.ok) {
        // Common case: another staff member already changed the status first —
        // surface the server's friendly message instead of crashing or retrying blindly.
        setError(result.error ?? "Status could not be updated.");
        return;
      }
      setConfirmTarget(null);
      setSuccessMessage(SUCCESS_MESSAGES[target] ?? "Status updated.");
      router.refresh();
    });
  }

  function handleClick(target: WebsiteOrderRequestStatus) {
    if (requiresConfirmation(target)) {
      setConfirmTarget(target);
      return;
    }
    submit(target);
  }

  const followUpUrl = buildWhatsAppUrl(
    whatsappNormalized,
    buildWebsiteRequestFollowUpMessage({ customerName, requestNumber }),
  );

  const showConfirmHelper = visibleNextStatuses.includes("confirmed");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size={size}>
          <a href={followUpUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden className="mr-2 h-4 w-4" />
            Open WhatsApp
          </a>
        </Button>

        {visibleNextStatuses.map((next) => (
          <Button
            key={next}
            size={size}
            variant={next === "cancelled" ? "destructive" : "outline"}
            disabled={isPending}
            onClick={() => handleClick(next)}
          >
            {isPending && confirmTarget === null ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {NEXT_STATUS_LABELS[next] ?? `Mark ${titleize(next)}`}
          </Button>
        ))}

        {showConvertPlaceholder && (
          <Button size={size} variant="outline" disabled title="Coming in a later unit">
            Convert to Order — coming next
          </Button>
        )}
      </div>

      {showConfirmHelper && (
        <p className="text-xs text-muted-foreground">
          Confirming this request does not create an order yet. Convert to Order will be handled
          next.
        </p>
      )}

      {helperNote && <p className="text-xs text-muted-foreground">{helperNote}</p>}

      {confirmTarget === "cancelled" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            Cancel this website request? This does not affect product stock.
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

      {successMessage && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-musiva-sage">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {successMessage}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
