import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceTemplate } from "@/components/print/invoice-template";
import { LabelTemplate } from "@/components/print/label-template";
import { PrintButton } from "@/components/print/print-button";
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
      <section className="print-combined-page">
        <div className="print-half">
          <LabelTemplate compact order={order} />
        </div>
        <div className="print-half">
          <InvoiceTemplate compact order={order} />
        </div>
      </section>
    </main>
  );
}
