import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { listInventoryVariants } from "@/lib/services/inventory.service";

export default async function StockAdjustmentsPage() {
  const variants = await listInventoryVariants({ page: 1 });

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Stock Management", href: "/admin/inventory" },
            { label: "Correct Quantity" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/inventory" label="Back to stock" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Correct Quantity</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set the exact stock quantity for a variant. A note is required and a movement is recorded.
        </p>
      </header>
      <StockAdjustmentForm variants={variants.data} />
    </div>
  );
}
