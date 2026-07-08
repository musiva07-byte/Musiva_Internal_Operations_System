import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageWidget } from "@/components/products/product-image-widget";
import { getProduct, listCategories } from "@/lib/services/product.service";
import { getProductImage } from "@/lib/services/product-image.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageProducts } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [categories, product, image, auth] = await Promise.all([
    listCategories(),
    getProduct(id),
    getProductImage(id),
    getCurrentAuthState(),
  ]);

  if (!product) {
    notFound();
  }

  const canEdit = canManageProducts(auth.profile?.role ?? null);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Products</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update product details and variant definitions. Use Inventory for stock changes.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Product image</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageWidget
            canEdit={canEdit}
            currentUrl={image?.url ?? null}
            productId={product.id}
          />
        </CardContent>
      </Card>

      <ProductForm categories={categories} product={product} />
    </div>
  );
}
