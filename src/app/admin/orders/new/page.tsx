import { SaleWizard } from "@/components/orders/sale-wizard";
import { listOrderableVariants } from "@/lib/services/order.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageProducts } from "@/lib/auth/permissions";

export default async function NewOrderPage() {
  const [variants, auth] = await Promise.all([listOrderableVariants(), getCurrentAuthState()]);
  const canAddProduct = canManageProducts(auth.profile?.role ?? null);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Orders</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New sale</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search or register a customer, pick items, set payment and delivery, then review.
        </p>
      </header>
      <SaleWizard variants={variants} canAddProduct={canAddProduct} />
    </div>
  );
}
