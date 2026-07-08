import { ProductWizard } from "@/components/products/product-wizard";
import { listCategories } from "@/lib/services/product.service";

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Products</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a new product in three steps: basic details, colors and sizes, then pricing and stock.
        </p>
      </header>
      <ProductWizard categories={categories} />
    </div>
  );
}
