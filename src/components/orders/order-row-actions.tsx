"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileText,
  MoreHorizontal,
  Package,
  Phone,
  Printer,
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
import { cancelOrderAction } from "@/app/admin/orders/actions";
import type { OrderListItem } from "@/types/app";

type OrderRowActionsProps = {
  order: OrderListItem;
  canCancel?: boolean;
};

export function OrderRowActions({ order, canCancel = false }: OrderRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const isDelivery = order.fulfilment_method === "delivery";
  const canBeCancelled = !["cancelled", "delivered", "returned"].includes(order.order_status);

  const whatsappUrl = order.customer_mobile
    ? `https://wa.me/${order.customer_mobile.replace(/\D/g, "")}?text=Hi%2C%20regarding%20your%20order%20${order.order_number}`
    : null;

  const callUrl = order.customer_mobile ? `tel:${order.customer_mobile}` : null;

  function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await cancelOrderAction(order.id);
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={handleCancel}
          disabled={isPending}
        >
          Confirm cancel
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setConfirming(false)}
        >
          Keep
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Order actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => window.open(`/print/invoice/${order.id}`, "_blank")}>
          <FileText className="mr-2 h-4 w-4" />
          Print invoice
        </DropdownMenuItem>

        {isDelivery && (
          <>
            <DropdownMenuItem onClick={() => window.open(`/print/label/${order.id}`, "_blank")}>
              <Package className="mr-2 h-4 w-4" />
              Print delivery label
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/print/combined/${order.id}`, "_blank")}>
              <Printer className="mr-2 h-4 w-4" />
              Print combined (A4)
            </DropdownMenuItem>
          </>
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

        {whatsappUrl && (
          <DropdownMenuItem onClick={() => window.open(whatsappUrl, "_blank")}>
            <svg className="mr-2 h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            WhatsApp
          </DropdownMenuItem>
        )}

        {canCancel && canBeCancelled && (
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
  );
}
