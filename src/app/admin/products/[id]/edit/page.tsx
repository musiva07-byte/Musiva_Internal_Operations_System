import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { ProductColorImageManager } from "@/components/products/product-color-image-manager";
import { getProduct, listCategories } from "@/lib/services/product.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { getCurrentExchangeRate } from "@/lib/services/exchange-rate.service";
import { canManageProducts } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { withProductReturnTo } from "@/lib/utils/product-catalog-return";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const rawReturnTo = resolvedSearchParams.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const [categories, product, auth, exchangeRate] = await Promise.all([
    listCategories(),
    getProduct(id),
    getCurrentAuthState(),
    getCurrentExchangeRate("INR"),
  ]);

  if (!product) {
    notFound();
  }

  const userRole = auth.profile?.role ?? null;
  const canEdit = canManageProducts(userRole);

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Product Catalog", href: "/admin/products" },
            { label: product.name, href: withProductReturnTo(`/admin/products/${product.id}`, returnTo) },
            { label: "Edit" },
          ]}
        />
        <div className="mt-2">
          <BackLink
            href={withProductReturnTo(`/admin/products/${product.id}`, returnTo)}
            label="Back to product"
          />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update product details and variant definitions. Use Inventory for stock changes.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Product Images</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a photo for each available color. Customers will see the photo matching their
            selected color.
          </p>
        </CardHeader>
        <CardContent>
          <ProductColorImageManager
            canEdit={canEdit}
            colors={product.variants.map((variant) => variant.color)}
            images={product.images}
            productId={product.id}
          />
        </CardContent>
      </Card>

      <ProductForm
        categories={categories}
        product={product}
        userRole={userRole}
        currentExchangeRate={exchangeRate?.rate ?? null}
        returnTo={returnTo}
      />
    </div>
  );
}
