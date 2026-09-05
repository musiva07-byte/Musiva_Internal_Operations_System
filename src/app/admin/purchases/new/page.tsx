import { PurchaseForm } from "@/components/purchases/purchase-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { listPurchasableVariants } from "@/lib/services/purchase.service";
import { listAllSuppliers } from "@/lib/services/supplier.service";

export default async function NewPurchasePage() {
  const [suppliers, variants] = await Promise.all([listAllSuppliers(), listPurchasableVariants()]);

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Management" },
            { label: "Purchases", href: "/admin/purchases" },
            { label: "New Purchase" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/purchases" label="Back to purchases" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New purchase order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Record supplier stock orders and received quantities for inventory intake.
        </p>
      </header>
      <PurchaseForm suppliers={suppliers} variants={variants} />
    </div>
  );
}
