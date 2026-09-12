import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageWidget } from "@/components/products/product-image-widget";
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

  const productImages = product.images;
  const mainImage = productImages.find((img) => !img.color) ?? null;
  const distinctColors = [...new Set(product.variants.map((v) => v.color))];
  function colorImageUrl(color: string): string | null {
    const normalized = color.trim().toLowerCase();
    return productImages.find((img) => img.color?.trim().toLowerCase() === normalized)?.url ?? null;
  }

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
          <CardTitle>Product images</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The main image is the default. Give a color its own photo only if it looks
            different — colors without one use the main image automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-1.5">
            <ProductImageWidget
              canEdit={canEdit}
              currentUrl={mainImage?.url ?? null}
              productId={product.id}
              title="Main product image"
            />
            <span className="text-xs font-medium text-musiva-plum">Main product image</span>
          </div>

          {distinctColors.length > 0 && (
            <div className="space-y-2 border-t border-dashed border-musiva-border pt-4">
              <p className="text-sm font-medium text-musiva-plum">Color images</p>
              <div className="flex flex-wrap gap-4">
                {distinctColors.map((color) => {
                  const url = colorImageUrl(color);
                  return (
                    <div key={color} className="flex flex-col items-center gap-1.5">
                      <ProductImageWidget
                        canEdit={canEdit}
                        color={color}
                        currentUrl={url}
                        productId={product.id}
                      />
                      <span className="max-w-[8rem] truncate text-xs font-medium text-musiva-plum">
                        {color}
                      </span>
                      {!url && (
                        <span className="text-[11px] text-muted-foreground">Using main image</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
