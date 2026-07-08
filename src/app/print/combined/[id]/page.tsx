import { notFound } from "next/navigation";
import { Scissors } from "lucide-react";
import { InvoiceTemplate } from "@/components/print/invoice-template";
import { LabelTemplate } from "@/components/print/label-template";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getOrder } from "@/lib/services/order.service";

type PrintCombinedPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrintCombinedPage({ params }: PrintCombinedPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  // Only show label-only link when the order has a delivery (not walk-in/pickup)
  const isDeliveryOrder = order.fulfilment_method === "delivery";

  return (
    <main className="min-h-screen bg-musiva-ivory py-6">
      <PrintToolbar
        orderId={order.id}
        showLabelOnly={isDeliveryOrder}
        showReceiptOnly
      />

      {/* A4 portrait — exact 210mm × 297mm, two equal halves */}
      <div className="print-combined-page">
        {/* Top half: Delivery label */}
        <div className="print-half">
          <LabelTemplate compact order={order} />
        </div>

        {/* CUT HERE divider */}
        <div aria-hidden className="print-cut-here">
          <Scissors aria-hidden />
          <span>Cut here</span>
        </div>

        {/* Bottom half: Customer receipt */}
        <div className="print-half">
          <InvoiceTemplate compact order={order} />
        </div>
      </div>
    </main>
  );
}
