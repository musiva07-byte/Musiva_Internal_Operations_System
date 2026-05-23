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
import type { CategoryRow } from "@/types/database";
import type { ProductWithRelations } from "@/types/app";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";

type ProductFormProps = {
  categories: CategoryRow[];
  product?: ProductWithRelations;
};

const emptyVariant = {
  variantSku: "",
  barcode: null,
  color: "",
  size: "",
  costPrice: 0,
  sellingPrice: 0,
  discountPrice: null,
  stockQuantity: 0,
  minimumStock: 1,
  status: PRODUCT_STATUSES.active,
};

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
    variants: product.variants.map((variant) => ({
      id: variant.id,
      variantSku: variant.variant_sku,
      barcode: variant.barcode,
      color: variant.color,
      size: variant.size,
      costPrice: Number(variant.cost_price),
      sellingPrice: Number(variant.selling_price),
      discountPrice: variant.discount_price === null ? null : Number(variant.discount_price),
      stockQuantity: variant.stock_quantity,
      minimumStock: variant.minimum_stock,
      status: variant.status,
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

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = Boolean(product);

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
