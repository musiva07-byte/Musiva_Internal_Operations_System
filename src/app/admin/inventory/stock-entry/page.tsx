import { ReceiveStockForm } from "@/components/inventory/receive-stock-form";
import { listInventoryVariants } from "@/lib/services/inventory.service";

export default async function ReceiveStockPage() {
  const variants = await listInventoryVariants({ page: 1 });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Stock</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Receive Stock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add newly received items to the available stock.
        </p>
      </header>
      <ReceiveStockForm variants={variants.data} />
    </div>
  );
}
