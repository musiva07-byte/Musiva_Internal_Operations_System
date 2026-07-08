import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabelTemplate } from "@/components/print/label-template";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getOrder } from "@/lib/services/order.service";

type PrintLabelPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrintLabelPage({ params }: PrintLabelPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  // For walk-in and customer-pickup orders, delivery labels are not normally needed.
  // Show an informational message instead, but still allow printing if staff insists.
  const isWalkIn = order.fulfilment_method === "walk_in" || order.fulfilment_method === "customer_pickup";

  if (isWalkIn) {
    return (
      <main className="min-h-screen bg-musiva-ivory py-6">
        <div className="no-print mx-auto flex w-[210mm] items-center gap-3 px-1 py-4">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/orders/${order.id}`}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to order
            </Link>
          </Button>
        </div>
        <div className="mx-auto w-[210mm] rounded-xl border border-musiva-border bg-white p-10 text-center shadow-soft">
          <Package className="mx-auto mb-4 h-12 w-12 text-musiva-muted" />
          <p className="text-base font-semibold text-musiva-ink">No delivery label needed</p>
          <p className="mt-2 text-sm text-musiva-muted">
            Order {order.order_number} is a{" "}
            {order.fulfilment_method === "walk_in" ? "walk-in" : "customer pickup"} order.
          </p>
          <p className="mt-1 text-sm text-musiva-muted">
            Delivery labels are only used for courier deliveries.
          </p>
          <Button
            className="mt-6"
            size="sm"
            variant="outline"
            onClick={undefined}
          >
            <Link href={`/print/invoice/${order.id}`}>
              Print receipt instead
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-musiva-ivory py-6">
      <PrintToolbar
        orderId={order.id}
        showLabelOnly={false}
        showReceiptOnly
      />
      <LabelTemplate order={order} />
    </main>
  );
}
