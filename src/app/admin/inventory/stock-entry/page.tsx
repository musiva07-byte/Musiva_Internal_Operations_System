import { StockEntryForm } from "@/components/inventory/stock-entry-form";
import { listInventoryVariants } from "@/lib/services/inventory.service";

export default async function StockEntryPage() {
  const variants = await listInventoryVariants({ page: 1 });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Inventory</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Stock entry</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add stock to an existing variant. This always creates a stock movement record.
        </p>
      </header>
      <StockEntryForm variants={variants.data} />
    </div>
  );
}
