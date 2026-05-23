import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { getProduct, listCategories } from "@/lib/services/product.service";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [categories, product] = await Promise.all([listCategories(), getProduct(id)]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Products</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update product details and variant definitions. Use Inventory for stock changes.
        </p>
      </header>
      <ProductForm categories={categories} product={product} />
    </div>
  );
}
