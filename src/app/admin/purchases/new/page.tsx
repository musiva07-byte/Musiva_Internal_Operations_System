import { PurchaseForm } from "@/components/purchases/purchase-form";
import { listPurchasableVariants } from "@/lib/services/purchase.service";
import { listAllSuppliers } from "@/lib/services/supplier.service";

export default async function NewPurchasePage() {
  const [suppliers, variants] = await Promise.all([listAllSuppliers(), listPurchasableVariants()]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Purchases</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New purchase order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Record supplier stock orders and received quantities for inventory intake.
        </p>
      </header>
      <PurchaseForm suppliers={suppliers} variants={variants} />
    </div>
  );
}
