"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  MessageCircle,
  Printer,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";

// ─── types ────────────────────────────────────────────────────────────────────

export type OrderSuccessSnapshot = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  paymentStatus: string;
  fulfilmentMethod: string;
  /** Always "pending" for new delivery orders; null for walk-in/pickup. */
  deliveryStatus: string | null;
};

type OrderSuccessModalProps = {
  snapshot: OrderSuccessSnapshot | null;
  onClose: () => void;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

export function isDeliveryOrder(fulfilmentMethod: string): boolean {
  return fulfilmentMethod === "delivery";
}

export function primaryActionLabel(fulfilmentMethod: string): string {
  return isDeliveryOrder(fulfilmentMethod) ? "Print Package Sheet" : "Print Receipt";
}

export function primaryPrintUrl(orderId: string, fulfilmentMethod: string): string {
  return isDeliveryOrder(fulfilmentMethod)
    ? `/print/combined/${orderId}`
    : `/print/invoice/${orderId}`;
}

// ─── component ────────────────────────────────────────────────────────────────

export function OrderSuccessModal({ snapshot, onClose }: OrderSuccessModalProps) {
  const router = useRouter();

  if (!snapshot) return null;

  const isDelivery = isDeliveryOrder(snapshot.fulfilmentMethod);

  function openPrint(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleViewOrder() {
    onClose();
    router.push(`/admin/orders/${snapshot!.id}`);
  }

  function handleCreateAnother() {
    onClose();
    router.push("/admin/orders/new");
  }

  function handleWhatsApp() {
    const message = buildWhatsAppMessage({
      customerName: snapshot!.customerName,
      orderNumber: snapshot!.orderNumber,
      grandTotal: snapshot!.grandTotal,
      paymentStatus: snapshot!.paymentStatus,
      deliveryStatus: snapshot!.deliveryStatus,
    });
    const url = buildWhatsAppUrl(snapshot!.customerPhone, message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={snapshot !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle aria-hidden className="h-5 w-5 text-[var(--status-success)]" />
            <DialogTitle>Order created successfully</DialogTitle>
          </div>
        </DialogHeader>

        {/* Order snapshot */}
        <div className="rounded-xl border border-musiva-border bg-[hsl(var(--secondary))] p-4 text-sm">
          <p className="mb-3 text-base font-semibold text-musiva-plum">
            {snapshot.orderNumber}
          </p>
          <dl className="space-y-1.5">
            <Row label="Customer" value={snapshot.customerName} />
            <Row label="Total" value={formatBhd(snapshot.grandTotal)} />
            <Row label="Payment" value={titleize(snapshot.paymentStatus)} />
            <Row
              label="Fulfilment"
              value={
                snapshot.fulfilmentMethod === "walk_in"
                  ? "Walk-in"
                  : snapshot.fulfilmentMethod === "customer_pickup"
                    ? "Customer Pickup"
                    : "Delivery"
              }
            />
            {isDelivery && snapshot.deliveryStatus && (
              <Row label="Delivery" value={titleize(snapshot.deliveryStatus)} />
            )}
          </dl>
        </div>

        {/* Primary action */}
        <Button
          className="mt-2 w-full"
          onClick={() => openPrint(primaryPrintUrl(snapshot.id, snapshot.fulfilmentMethod))}
        >
          <Printer aria-hidden className="mr-2 h-4 w-4" />
          {primaryActionLabel(snapshot.fulfilmentMethod)}
          <ExternalLink aria-hidden className="ml-auto h-3.5 w-3.5 opacity-60" />
        </Button>

        {/* Secondary actions row */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={handleViewOrder}
          >
            View order
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={handleCreateAnother}
          >
            Create another sale
          </Button>
        </div>

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full" variant="ghost" size="sm">
              More actions
              <ChevronDown aria-hidden className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuItem onClick={() => openPrint(`/print/invoice/${snapshot.id}`)}>
              <FileText aria-hidden className="mr-2 h-4 w-4" />
              Print receipt only
            </DropdownMenuItem>
            {isDelivery && (
              <DropdownMenuItem onClick={() => openPrint(`/print/label/${snapshot.id}`)}>
                <Tags aria-hidden className="mr-2 h-4 w-4" />
                Print label only
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleWhatsApp}>
              <MessageCircle aria-hidden className="mr-2 h-4 w-4" />
              Send WhatsApp confirmation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-musiva-ink">{value}</dd>
    </div>
  );
}
