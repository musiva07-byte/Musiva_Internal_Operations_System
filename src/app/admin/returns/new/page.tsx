import { ReturnForm } from "@/components/returns/return-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { listRecentReturnableItems, listReturnOrders } from "@/lib/services/return.service";

export default async function NewReturnPage() {
  const [orders, orderItems] = await Promise.all([listReturnOrders(), listRecentReturnableItems()]);

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Daily Work" },
            { label: "Returns & Exchanges", href: "/admin/returns" },
            { label: "New Return" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/returns" label="Back to returns" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New return or exchange</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select the original order and choose how each returned item should affect stock.
        </p>
      </header>
      <ReturnForm orderItems={orderItems} orders={orders} />
    </div>
  );
}
