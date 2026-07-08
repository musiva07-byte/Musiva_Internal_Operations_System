import { SaleWizard } from "@/components/orders/sale-wizard";
import { listOrderableVariants } from "@/lib/services/order.service";

export default async function NewOrderPage() {
  const variants = await listOrderableVariants();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Orders</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New sale</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search or register a customer, pick items, set payment and delivery, then review.
        </p>
      </header>
      <SaleWizard variants={variants} />
    </div>
  );
}
