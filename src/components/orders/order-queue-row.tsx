"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Package,
  Phone,
  Printer,
  Tags,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badge";
import { DeliveryStatusBadge } from "@/components/deliveries/delivery-status-badge";
import { formatBhd } from "@/lib/formatters/currency";
import { formatBahrainPhone } from "@/lib/utils/phone";
import { FULFILMENT_METHOD_LABELS } from "@/lib/constants";
import {
  transitionOrderStatusAction,
  cancelOrderAction,
  confirmOrderHandoffAction,
} from "@/app/admin/orders/actions";
import {
  needsAttentionOrder,
  ORDER_ATTENTION_LABELS,
} from "@/lib/utils/queue";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { titleize } from "@/lib/formatters/labels";
import type { OrderListItem } from "@/types/app";
import type { DeliveryStatus } from "@/types/database";

// ─── Derived action per order ────────────────────────────────────────────────

type PrimaryAction =
  | { kind: "confirm-walk-in" }
  | { kind: "confirm-delivery" }        // → confirmOrderHandoff
  | { kind: "complete-walk-in" }        // confirmed walk-in → completed
  | { kind: "open-delivery"; deliveryId: string }  // delivery order in_fulfilment
  | { kind: "view" }                    // terminal
  | null;

function getPrimaryAction(order: OrderListItem): PrimaryAction {
  const { order_status, fulfilment_method, delivery_id } = order;

  if (order_status === "new") {
    return fulfilment_method === "delivery"
      ? { kind: "confirm-delivery" }
      : { kind: "confirm-walk-in" };
  }

  if (order_status === "confirmed" && fulfilment_method !== "delivery") {
    return { kind: "complete-walk-in" };
  }

  if (
    order_status === "in_fulfilment" ||
    // Legacy statuses — treat as in-fulfilment
    order_status === "packed" ||
    order_status === "ready_for_pickup" ||
    order_status === "out_for_delivery"
  ) {
    if (delivery_id) return { kind: "open-delivery", deliveryId: delivery_id };
    return { kind: "view" };
  }

  if (["completed", "delivered", "cancelled", "returned", "exchange_requested"].includes(order_status)) {
    return { kind: "view" };
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  order: OrderListItem;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
};

export function OrderQueueRow({ order, isSelected, onSelect }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const attention = needsAttentionOrder(order);
  const primaryAction = getPrimaryAction(order);
  const isDelivery = order.fulfilment_method === "delivery";
  const canBeCancelled = !["cancelled", "completed", "delivered", "returned"].includes(
    order.order_status,
  );
  const isTerminal = ["completed", "delivered", "cancelled", "returned", "exchange_requested"].includes(
    order.order_status,
  );

  const displayPhone = formatBahrainPhone(order.customer_mobile) || order.customer_mobile;
  const whatsappMessage = buildWhatsAppMessage({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    grandTotal: order.grand_total,
    paymentStatus: order.payment_status,
    deliveryStatus: null,
  });
  const whatsappUrl = buildWhatsAppUrl(order.customer_mobile, whatsappMessage);
  const callUrl = order.customer_mobile ? `tel:${order.customer_mobile}` : null;

  function runAction(fn: () => Promise<{ ok: boolean; error?: string | null }>) {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setActionError(result.error ?? "Action could not be completed.");
        return;
      }
      router.refresh();
    });
  }

  function handlePrimary() {
    if (!primaryAction) return;
    if (primaryAction.kind === "confirm-delivery") {
      runAction(() => confirmOrderHandoffAction(order.id));
    } else if (primaryAction.kind === "confirm-walk-in") {
      runAction(() => transitionOrderStatusAction(order.id, "confirmed"));
    } else if (primaryAction.kind === "complete-walk-in") {
      runAction(() => transitionOrderStatusAction(order.id, "completed"));
    } else if (primaryAction.kind === "open-delivery") {
      router.push(`/admin/deliveries/${primaryAction.deliveryId}`);
    } else {
      router.push(`/admin/orders/${order.id}`);
    }
  }

  function handleCancel() {
    if (!cancelConfirm) { setCancelConfirm(true); return; }
    runAction(() => cancelOrderAction(order.id));
  }

  // ── Cancel confirm inline ─────────────────────────────────────────────────
  if (cancelConfirm) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="flex-1 text-sm font-medium text-destructive">
          Cancel order {order.order_number}?
        </p>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={handleCancel}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm cancel"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setCancelConfirm(false)}
          disabled={isPending}
        >
          Keep
        </Button>
      </div>
    );
  }

  // ── Primary button label and icon ─────────────────────────────────────────
  function renderPrimaryButton() {
    if (!primaryAction || primaryAction.kind === "view") return null;

    let label = "";
    let Icon = CheckCircle2;

    switch (primaryAction.kind) {
      case "confirm-delivery":
        label = "Confirm & send to delivery";
        Icon = CheckCircle2;
        break;
      case "confirm-walk-in":
        label = "Confirm order";
        Icon = CheckCircle2;
        break;
      case "complete-walk-in":
        label = "Mark complete";
        Icon = CheckCircle2;
        break;
      case "open-delivery":
        label = "Open delivery";
        Icon = Truck;
        break;
    }

    const isLink = primaryAction.kind === "open-delivery";

    return (
      <Button
        size="sm"
        variant={isLink ? "outline" : "default"}
        className="h-7 text-xs"
        onClick={handlePrimary}
        disabled={isPending && !isLink}
      >
        {isPending && !isLink ? (
          <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon aria-hidden className="mr-1 h-3.5 w-3.5" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-[hsl(var(--border))/80] ${
        attention ? "border-amber-200/60 bg-amber-50/30" : "border-[hsl(var(--border))]"
      } ${isSelected ? "ring-2 ring-[var(--brand-mauve)] ring-offset-1" : ""}`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[hsl(var(--input))] accent-[var(--brand-mauve)]"
        checked={isSelected}
        onChange={(e) => onSelect(order.id, e.target.checked)}
        aria-label={`Select ${order.order_number}`}
      />

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            className="text-sm font-semibold text-musiva-plum hover:underline"
            onClick={() => router.push(`/admin/orders/${order.id}`)}
          >
            {order.order_number}
          </button>
          <OrderStatusBadge status={order.order_status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>

        <p className="mt-0.5 text-sm text-foreground">
          {order.customer_name}
          {displayPhone && (
            <span className="ml-2 text-muted-foreground">{displayPhone}</span>
          )}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
            {FULFILMENT_METHOD_LABELS[order.fulfilment_method] ?? titleize(order.fulfilment_method)}
          </Badge>
          <span className="font-medium text-musiva-plum">{formatBhd(order.grand_total)}</span>
          {order.item_count > 0 && (
            <span>{order.item_count} item{order.item_count !== 1 ? "s" : ""}</span>
          )}
          {/* For in-fulfilment delivery orders show the delivery status inline */}
          {isDelivery &&
            order.delivery_status &&
            (order.order_status === "in_fulfilment" ||
              order.order_status === "packed" ||
              order.order_status === "ready_for_pickup" ||
              order.order_status === "out_for_delivery") && (
              <DeliveryStatusBadge status={order.delivery_status as DeliveryStatus} />
            )}
        </div>

        {attention && (
          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>{ORDER_ATTENTION_LABELS[attention]}</span>
          </div>
        )}

        {actionError && (
          <p className="mt-1 text-xs text-destructive">{actionError}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Primary action */}
        {renderPrimaryButton()}

        {/* Terminal orders: View button */}
        {isTerminal && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => router.push(`/admin/orders/${order.id}`)}
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              View order
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {isDelivery && (
              <DropdownMenuItem
                onClick={() => window.open(`/print/combined/${order.id}`, "_blank")}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print package sheet
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => window.open(`/print/invoice/${order.id}`, "_blank")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Print receipt
            </DropdownMenuItem>
            {isDelivery && (
              <DropdownMenuItem
                onClick={() => window.open(`/print/label/${order.id}`, "_blank")}
              >
                <Tags className="mr-2 h-4 w-4" />
                Print label
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {callUrl && (
              <DropdownMenuItem asChild>
                <a href={callUrl}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call customer
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp customer
            </DropdownMenuItem>

            {/* Open delivery (always accessible for delivery orders with a delivery record) */}
            {isDelivery && order.delivery_id && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/deliveries/${order.delivery_id}`)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Open delivery
                </DropdownMenuItem>
              </>
            )}

            {canBeCancelled && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleCancel}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel order
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
