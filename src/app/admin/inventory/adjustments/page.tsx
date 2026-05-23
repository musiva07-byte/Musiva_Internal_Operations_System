import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
import { listInventoryVariants } from "@/lib/services/inventory.service";

export default async function StockAdjustmentsPage() {
  const variants = await listInventoryVariants({ page: 1 });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Inventory</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Manual adjustments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set the exact stock quantity for a variant. A note is required and a movement is recorded.
        </p>
      </header>
      <StockAdjustmentForm variants={variants.data} />
    </div>
  );
}
