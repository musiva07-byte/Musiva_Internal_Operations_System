"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { productSchema, type ProductInput } from "@/lib/validations/product.schema";
import { canPublishProducts } from "@/lib/auth/permissions";
import type { CategoryRow, StaffRole } from "@/types/database";
import type { ProductWithRelations } from "@/types/app";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";

type ProductFormProps = {
  categories: CategoryRow[];
  product?: ProductWithRelations;
  userRole: StaffRole | null;
};

const emptyVariant = {
  variantSku: "",
  barcode: null,
  color: "",
  size: "",
  costPrice: 0,
  sellingPrice: 0,
  discountPrice: null,
  regularSellingPriceBhd: 0,
  discountPriceBhd: null,
  discountStartAt: null,
  discountEndAt: null,
  stockQuantity: 0,
  minimumStock: 1,
  buyingPriceInr: 0,
  additionalLandedCostBhd: 0,
  status: PRODUCT_STATUSES.active,
} as const;

function mapProduct(product?: ProductWithRelations): ProductInput {
  if (!product) {
    return {
      name: "",
      sku: "",
      categoryId: null,
      collection: null,
      description: null,
      material: null,
      careInstructions: null,
      status: PRODUCT_STATUSES.active,
      variants: [emptyVariant],
      images: [],
      slug: null,
      websiteVisible: false,
      onlineStatus: "hidden",
      websiteTitle: null,
      websiteDescription: null,
      seoTitle: null,
      seoDescription: null,
      featured: false,
      newArrival: false,
      sortOrder: 0,
    };
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    categoryId: product.category_id,
    collection: product.collection,
    description: product.description,
    material: product.material,
    careInstructions: product.care_instructions,
    status: product.status,
    slug: product.slug,
    websiteVisible: product.website_visible,
    onlineStatus: product.online_status,
    websiteTitle: product.website_title,
    websiteDescription: product.website_description,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    featured: product.featured,
    newArrival: product.new_arrival,
    sortOrder: product.sort_order,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      variantSku: variant.variant_sku,
      barcode: variant.barcode,
      color: variant.color,
      size: variant.size,
      costPrice: Number(variant.cost_price),
      sellingPrice: Number(variant.selling_price),
      discountPrice: variant.discount_price === null ? null : Number(variant.discount_price),
      regularSellingPriceBhd: Number(variant.regular_selling_price_bhd ?? variant.selling_price),
      discountPriceBhd: variant.discount_price_bhd === null ? null : Number(variant.discount_price_bhd),
      discountStartAt: variant.discount_start_at ?? null,
      discountEndAt: variant.discount_end_at ?? null,
      stockQuantity: variant.stock_quantity,
      minimumStock: variant.minimum_stock,
      buyingPriceInr: 0,
      additionalLandedCostBhd: 0,
      status: (["active", "inactive", "archived", "draft"].includes(variant.status)
        ? variant.status
        : "active") as "active" | "inactive" | "archived" | "draft",
    })),
    images: product.images.map((image) => ({
      id: image.id,
      variantId: image.variant_id,
      url: image.url,
      path: image.path,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    })),
  };
}

export function ProductForm({ categories, product, userRole }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = Boolean(product);
  const canPublish = canPublishProducts(userRole);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: mapProduct(product),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  function onSubmit(values: ProductInput) {
    setFormError(null);
    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, values)
        : await createProductAction(values);

      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Product could not be saved.");
        return;
      }

      router.push(`/admin/products/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" {...form.register("name")} placeholder="Satin Dress" />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">Product SKU</Label>
            <Input id="sku" {...form.register("sku")} placeholder="MSV-DRS-001" />
            <FieldError message={form.formState.errors.sku?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select id="category" {...form.register("categoryId")}>
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...form.register("status")}>
              <option value={PRODUCT_STATUSES.active}>Active</option>
              <option value={PRODUCT_STATUSES.inactive}>Inactive</option>
              <option value={PRODUCT_STATUSES.archived}>Archived</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection">Collection</Label>
            <Input id="collection" {...form.register("collection")} placeholder="Ramadan Edit" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material">Material</Label>
            <Input id="material" {...form.register("material")} placeholder="Silk blend" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register("description")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="careInstructions">Care instructions</Label>
            <Textarea id="careInstructions" {...form.register("careInstructions")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Color and size variants</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Stock belongs to variants. Existing variant stock must be changed from Inventory.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ ...emptyVariant, variantSku: `${form.getValues("sku")}-` })}
          >
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            Add variant
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 rounded-md border bg-musiva-ivory p-4 lg:grid-cols-6">
              <input type="hidden" {...form.register(`variants.${index}.id`)} />
              <div className="space-y-2 lg:col-span-2">
                <Label>Variant SKU</Label>
                <Input {...form.register(`variants.${index}.variantSku`)} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input {...form.register(`variants.${index}.color`)} placeholder="Black" />
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <Input {...form.register(`variants.${index}.size`)} placeholder="M" />
              </div>
              <div className="space-y-2">
                <Label>Selling price</Label>
                <Input step="0.001" type="number" {...form.register(`variants.${index}.sellingPrice`)} />
              </div>
              <div className="space-y-2">
                <Label>Minimum stock</Label>
                <Input type="number" {...form.register(`variants.${index}.minimumStock`)} />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input {...form.register(`variants.${index}.barcode`)} />
              </div>
              <div className="space-y-2">
                <Label>Cost price</Label>
                <Input step="0.001" type="number" {...form.register(`variants.${index}.costPrice`)} />
              </div>
              <div className="space-y-2">
                <Label>Discount price</Label>
                <Input step="0.001" type="number" {...form.register(`variants.${index}.discountPrice`)} />
              </div>
              <div className="space-y-2">
                <Label>{isEditing && field.id ? "Current stock" : "Opening stock"}</Label>
                <Input
                  readOnly={isEditing && Boolean(field.id)}
                  type="number"
                  {...form.register(`variants.${index}.stockQuantity`)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select {...form.register(`variants.${index}.status`)}>
                  <option value={PRODUCT_STATUSES.active}>Active</option>
                  <option value={PRODUCT_STATUSES.inactive}>Inactive</option>
                  <option value={PRODUCT_STATUSES.archived}>Archived</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  disabled={fields.length === 1}
                  type="button"
                  variant="outline"
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <FieldError message={form.formState.errors.variants?.message} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Ecommerce / Website</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Only published products marked Show on website will appear on www.moosivabh.com.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium text-musiva-plum">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-musiva-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canPublish}
                {...form.register("websiteVisible")}
              />
              Show on website
            </label>

            <div className="space-y-2">
              <Label htmlFor="onlineStatus">Online status</Label>
              <Select id="onlineStatus" {...form.register("onlineStatus")}>
                <option value="draft">Draft</option>
                <option value="published" disabled={!canPublish}>
                  Published
                </option>
                <option value="hidden">Hidden</option>
              </Select>
              {!canPublish && (
                <p className="text-xs text-muted-foreground">
                  Only owner and manager can publish products. You can save website details as
                  draft.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="slug">Website slug</Label>
              <Input id="slug" {...form.register("slug")} placeholder="pearl-trim-abaya" />
              <p className="text-xs text-muted-foreground">
                Auto-generated from the product name if left blank. Changing it later changes the
                product&apos;s public URL.
              </p>
              <FieldError message={form.formState.errors.slug?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteTitle">Website title (optional)</Label>
              <Input
                id="websiteTitle"
                {...form.register("websiteTitle")}
                placeholder="Defaults to the product name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="websiteDescription">Website description (optional)</Label>
              <Textarea
                id="websiteDescription"
                rows={3}
                {...form.register("websiteDescription")}
                placeholder="Shown on the product page on the public website."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO title (optional)</Label>
              <Input id="seoTitle" {...form.register("seoTitle")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoDescription">SEO description (optional)</Label>
              <Input id="seoDescription" {...form.register("seoDescription")} />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-musiva-plum">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-musiva-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register("featured")}
              />
              Featured product
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-musiva-plum">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-musiva-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register("newArrival")}
              />
              New arrival
            </label>
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save product"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
