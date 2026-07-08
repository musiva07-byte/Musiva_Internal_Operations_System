"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Loader2, Package, Printer, Tags, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DELIVERY_NEXT_STATUSES, DELIVERY_STATUSES_REQUIRING_REASON } from "@/lib/constants";
import { advanceDeliveryStatusAction } from "@/app/admin/deliveries/actions";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import type { DeliveryListItem } from "@/types/app";
import type { DeliveryStatus } from "@/types/database";

type DeliveryRowActionsProps = {
  delivery: DeliveryListItem;
};

type DialogState =
  | { type: "none" }
  | { type: "reason"; targetStatus: DeliveryStatus; }
  | { type: "cod"; targetStatus: "delivered"; };

const NEXT_STATUS_LABELS: Partial<Record<DeliveryStatus, string>> = {
  packed: "Mark Packed",
  ready_for_pickup: "Mark Ready",
  with_courier: "Assign Courier",
  out_for_delivery: "Out for Delivery",
  delivered: "Mark Delivered",
};

export function DeliveryRowActions({ delivery }: DeliveryRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [collectedAmount, setCollectedAmount] = useState<number>(delivery.amount_due ?? 0);
  const [actionError, setActionError] = useState<string | null>(null);

  const nextStatuses = (DELIVERY_NEXT_STATUSES[delivery.delivery_status] ?? []) as DeliveryStatus[];
  const primaryNext = nextStatuses[0];
  const isCod = delivery.payment_status === "cod";

  function handleAdvance(targetStatus: DeliveryStatus) {
    const requiresReason = DELIVERY_STATUSES_REQUIRING_REASON.includes(targetStatus);
    const requiresCodCollection = targetStatus === "delivered" && isCod && !delivery.cod_collected;

    if (requiresReason) {
      setReason("");
      setNote("");
      setDialog({ type: "reason", targetStatus });
      return;
    }

    if (requiresCodCollection) {
      setCollectedAmount(delivery.amount_due);
      setDialog({ type: "cod", targetStatus: "delivered" });
      return;
    }

    submitAdvance(targetStatus, undefined, undefined, undefined);
  }

  function submitAdvance(
    targetStatus: DeliveryStatus,
    advanceReason?: string,
    advanceNote?: string,
    collected?: number,
  ) {
    setActionError(null);
    startTransition(async () => {
      const result = await advanceDeliveryStatusAction(
        delivery.id,
        targetStatus,
        advanceReason,
        advanceNote,
        collected,
      );
      if (!result.ok) {
        setActionError(result.error ?? "Status could not be updated.");
        return;
      }
      setDialog({ type: "none" });
      router.refresh();
    });
  }

  function handleDialogSubmit() {
    if (dialog.type === "reason") {
      if (!reason.trim()) {
        setActionError("A reason is required.");
        return;
      }
      submitAdvance(dialog.targetStatus, reason.trim(), note.trim() || undefined);
    } else if (dialog.type === "cod") {
      submitAdvance("delivered", undefined, undefined, collectedAmount);
    }
  }

  // Inline dialog overlay
  if (dialog.type !== "none") {
    const isReason = dialog.type === "reason";
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-white p-3 shadow-soft">
        <p className="text-sm font-semibold">
          {isReason
            ? `Mark as ${titleize(dialog.targetStatus)}`
            : "Record COD collection"}
        </p>
        {isReason && (
          <>
            <div>
              <Label className="mb-1 block text-xs">Reason *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer not available"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </>
        )}
        {dialog.type === "cod" && (
          <div>
            <Label className="mb-1 block text-xs">Amount collected (BHD)</Label>
            <Input
              type="number"
              min={0}
              step={0.001}
              value={collectedAmount || ""}
              onChange={(e) => setCollectedAmount(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs"
              placeholder={formatBhd(delivery.amount_due)}
            />
          </div>
        )}
        {actionError && <p className="text-xs text-destructive">{actionError}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleDialogSubmit}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setDialog({ type: "none" });
              setActionError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {/* Primary next-action button */}
      {primaryNext && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => handleAdvance(primaryNext)}
          disabled={isPending}
          title={NEXT_STATUS_LABELS[primaryNext] ?? titleize(primaryNext)}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
              {NEXT_STATUS_LABELS[primaryNext] ?? titleize(primaryNext)}
            </>
          )}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <Package className="h-3.5 w-3.5" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => window.open(`/print/label/${delivery.order_id}`, "_blank")}>
            <Tags className="mr-2 h-4 w-4" />
            Print label
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(`/print/combined/${delivery.order_id}`, "_blank")}>
            <Printer className="mr-2 h-4 w-4" />
            Print combined
          </DropdownMenuItem>

          {/* Secondary next statuses */}
          {nextStatuses.slice(1).map((ns) => (
            <DropdownMenuItem key={ns} onClick={() => handleAdvance(ns)}>
              <ArrowRight className="mr-2 h-4 w-4" />
              {NEXT_STATUS_LABELS[ns] ?? titleize(ns)}
            </DropdownMenuItem>
          ))}

          {/* Exceptional transitions */}
          {!["delivered", "returned", "cancelled"].includes(delivery.delivery_status) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleAdvance("failed")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Mark Failed
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleAdvance("returned")}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Returned
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
