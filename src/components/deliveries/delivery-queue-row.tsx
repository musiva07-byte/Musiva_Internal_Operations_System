"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Printer,
  Tags,
  XCircle,
} from "lucide-react";
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
import { DeliveryStatusBadge } from "@/components/deliveries/delivery-status-badge";
import { PaymentStatusBadge } from "@/components/orders/status-badge";
import { formatBhd } from "@/lib/formatters/currency";
import { DELIVERY_NEXT_STATUSES, DELIVERY_STATUSES_REQUIRING_REASON } from "@/lib/constants";
import {
  needsAttentionDelivery,
  DELIVERY_ATTENTION_LABELS,
} from "@/lib/utils/queue";
import { advanceDeliveryStatusAction } from "@/app/admin/deliveries/actions";
import { titleize } from "@/lib/formatters/labels";
import type { DeliveryListItem } from "@/types/app";
import type { DeliveryStatus } from "@/types/database";

// ─── Next-action button labels ────────────────────────────────────────────────

const NEXT_STATUS_LABELS: Partial<Record<DeliveryStatus, string>> = {
  packed: "Mark packed",
  ready_for_pickup: "Mark ready",
  with_courier: "Assign courier",
  out_for_delivery: "Start delivery",
  delivered: "Mark delivered",
  returned_to_store: "Return to store",
  cancelled: "Cancel delivery",
};

// ─── Dialog state ─────────────────────────────────────────────────────────────

type DialogState =
  | { type: "none" }
  | { type: "reason"; targetStatus: DeliveryStatus }
  | { type: "cod"; targetStatus: "delivered" };

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  delivery: DeliveryListItem;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
};

export function DeliveryQueueRow({ delivery, isSelected, onSelect }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [collectedAmount, setCollectedAmount] = useState<number>(delivery.amount_due ?? 0);
  const [actionError, setActionError] = useState<string | null>(null);

  const attention = needsAttentionDelivery(delivery);
  const nextStatuses = (DELIVERY_NEXT_STATUSES[delivery.delivery_status] ?? []) as DeliveryStatus[];
  const primaryNext = nextStatuses[0];
  const isCod = delivery.payment_status === "cod";
  const isTerminal = ["delivered", "returned", "returned_to_store", "cancelled"].includes(
    delivery.delivery_status,
  );

  function handleAdvance(targetStatus: DeliveryStatus) {
    const requiresReason = DELIVERY_STATUSES_REQUIRING_REASON.includes(targetStatus);
    const requiresCod =
      targetStatus === "delivered" && isCod && !delivery.cod_collected;

    if (requiresReason) {
      setReason("");
      setNote("");
      setDialog({ type: "reason", targetStatus });
      return;
    }
    if (requiresCod) {
      setCollectedAmount(delivery.amount_due);
      setDialog({ type: "cod", targetStatus: "delivered" });
      return;
    }
    submitAdvance(targetStatus);
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

  // ── Inline dialog ─────────────────────────────────────────────────────────
  if (dialog.type !== "none") {
    const isReason = dialog.type === "reason";
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-3 shadow-sm">
        <p className="mb-2 text-sm font-semibold">
          {isReason ? `Mark as ${titleize(dialog.targetStatus)}` : "Record COD collection"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {delivery.order_number} · {delivery.customer_name}
          </span>
        </p>

        {isReason && (
          <>
            <div className="mb-2">
              <Label className="mb-1 block text-xs">Reason *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer not available"
                className="h-8 text-xs"
              />
            </div>
            <div className="mb-2">
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
          <div className="mb-2">
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

        {actionError && <p className="mb-2 text-xs text-destructive">{actionError}</p>}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleDialogSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Confirm"
            )}
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
    <div
      className={`group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors ${
        attention === "failed"
          ? "border-red-200/60 bg-red-50/20"
          : attention
            ? "border-amber-200/60 bg-amber-50/30"
            : "border-[hsl(var(--border))]"
      } ${isSelected ? "ring-2 ring-[var(--brand-mauve)] ring-offset-1" : ""}`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[hsl(var(--input))] accent-[var(--brand-mauve)]"
        checked={isSelected}
        onChange={(e) => onSelect(delivery.id, e.target.checked)}
        aria-label={`Select ${delivery.order_number}`}
      />

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            className="text-sm font-semibold text-musiva-plum hover:underline"
            onClick={() => router.push(`/admin/deliveries/${delivery.id}`)}
          >
            {delivery.order_number}
          </button>
          <DeliveryStatusBadge status={delivery.delivery_status} />
          <PaymentStatusBadge status={delivery.payment_status as import("@/types/database").PaymentStatus} />
        </div>

        <p className="mt-0.5 text-sm font-medium text-foreground">{delivery.customer_name}</p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {delivery.area && <span>{delivery.area}</span>}
          {delivery.governorate && <span>{delivery.governorate}</span>}
          {isCod && delivery.amount_due > 0 && (
            <span className="font-medium text-musiva-plum">
              Collect {formatBhd(delivery.amount_due)}
            </span>
          )}
        </div>

        {attention && (
          <div
            className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
              attention === "failed" ? "text-red-700" : "text-amber-700"
            }`}
          >
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>{DELIVERY_ATTENTION_LABELS[attention]}</span>
          </div>
        )}

        {actionError && (
          <p className="mt-1 text-xs text-destructive">{actionError}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Primary next action */}
        {!isTerminal && primaryNext && (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleAdvance(primaryNext)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight aria-hidden className="mr-1 h-3.5 w-3.5" />
            )}
            {NEXT_STATUS_LABELS[primaryNext] ?? titleize(primaryNext)}
          </Button>
        )}

        {isTerminal && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => router.push(`/admin/deliveries/${delivery.id}`)}
          >
            <Eye aria-hidden className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
        )}

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreHorizontal aria-hidden className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => router.push(`/admin/deliveries/${delivery.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              View delivery
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/admin/orders/${delivery.order_id}`)}
            >
              <FileText className="mr-2 h-4 w-4" />
              View order
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => window.open(`/print/combined/${delivery.order_id}`, "_blank")}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print package sheet
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`/print/label/${delivery.order_id}`, "_blank")}
            >
              <Tags className="mr-2 h-4 w-4" />
              Print label
            </DropdownMenuItem>

            {/* Secondary next statuses */}
            {nextStatuses.slice(1).map((ns) => (
              <DropdownMenuItem key={ns} onClick={() => handleAdvance(ns)}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {NEXT_STATUS_LABELS[ns] ?? titleize(ns)}
              </DropdownMenuItem>
            ))}

            {/* Exceptional transitions — only when not already terminal */}
            {!isTerminal && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleAdvance("failed")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark failed
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleAdvance("returned_to_store")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Return to store
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
