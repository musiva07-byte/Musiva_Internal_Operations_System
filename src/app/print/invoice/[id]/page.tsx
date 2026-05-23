import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceTemplate } from "@/components/print/invoice-template";
import { PrintButton } from "@/components/print/print-button";
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

  return (
    <main className="min-h-screen bg-musiva-ivory py-6">
      <div className="no-print mx-auto flex w-[210mm] items-center justify-between">
        <Button asChild variant="outline">
          <Link href={`/admin/orders/${order.id}`}>
            <ArrowLeft aria-hidden className="mr-2 h-4 w-4" />
            Back to order
          </Link>
        </Button>
        <PrintButton />
      </div>
      <InvoiceTemplate order={order} />
    </main>
  );
}
