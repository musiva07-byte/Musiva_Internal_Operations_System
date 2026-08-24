import { ReceiveStockForm } from "@/components/inventory/receive-stock-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { listInventoryVariants } from "@/lib/services/inventory.service";

export default async function ReceiveStockPage() {
  const variants = await listInventoryVariants({ page: 1 });

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Stock Management", href: "/admin/inventory" },
            { label: "Receive Stock" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/inventory" label="Back to stock" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Receive Stock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add newly received items to the available stock.
        </p>
      </header>
      <ReceiveStockForm variants={variants.data} />
    </div>
  );
}
