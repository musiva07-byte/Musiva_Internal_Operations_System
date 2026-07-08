import { notFound } from "next/navigation";
import { InvoiceTemplate } from "@/components/print/invoice-template";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getOrder } from "@/lib/services/order.service";

type PrintInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrintInvoicePage({ params }: PrintInvoicePageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const isDeliveryOrder = order.fulfilment_method === "delivery";

  return (
    <main className="min-h-screen bg-musiva-ivory py-6">
      <PrintToolbar
        orderId={order.id}
        showLabelOnly={isDeliveryOrder}
        showReceiptOnly={false}
      />
      <InvoiceTemplate order={order} />
    </main>
  );
}
