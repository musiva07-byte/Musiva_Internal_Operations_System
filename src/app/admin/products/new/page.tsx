import { ProductWizard } from "@/components/products/product-wizard";
import { listCategories } from "@/lib/services/product.service";
import { getCurrentExchangeRate } from "@/lib/services/exchange-rate.service";
import { getCurrentAuthState } from "@/lib/auth/session";

export default async function NewProductPage() {
  const [categories, auth, exchangeRate] = await Promise.all([
    listCategories(),
    getCurrentAuthState(),
    getCurrentExchangeRate("INR"),
  ]);
  const userRole = auth.profile?.role ?? null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Products</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a new product in three steps: basic details, colors and sizes, then pricing and stock.
        </p>
      </header>
      <ProductWizard
        categories={categories}
        userRole={userRole}
        currentExchangeRate={exchangeRate?.rate ?? null}
        currentExchangeRateDate={exchangeRate?.rate_date ?? null}
        currentExchangeRateSource={exchangeRate?.source ?? null}
      />
    </div>
  );
}
