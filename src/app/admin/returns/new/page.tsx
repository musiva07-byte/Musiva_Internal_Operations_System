import { ReturnForm } from "@/components/returns/return-form";
import { listRecentReturnableItems, listReturnOrders } from "@/lib/services/return.service";

export default async function NewReturnPage() {
  const [orders, orderItems] = await Promise.all([listReturnOrders(), listRecentReturnableItems()]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Returns</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New return or exchange</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select the original order and choose how each returned item should affect stock.
        </p>
      </header>
      <ReturnForm orderItems={orderItems} orders={orders} />
    </div>
  );
}
