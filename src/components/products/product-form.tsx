"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect } from "@/components/products/category-select";
import {
  PriceConfirmationDialog,
  type PriceConfirmationRow,
} from "@/components/products/price-confirmation-dialog";
import {
  ProductSaveSuccessDialog,
  type SaveSuccessInfo,
} from "@/components/products/product-save-success-dialog";
import { ReceiveStockModal } from "@/components/products/receive-stock-modal";
import { CorrectQuantityModal } from "@/components/products/correct-quantity-modal";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { productSchema, type ProductInput } from "@/lib/validations/product.schema";
import {
  canPublishProducts,
  canEnterBuyingCost,
  canViewCostData,
  canAdjustInventory,
} from "@/lib/auth/permissions";
import {
  deriveImportCostBhd,
  deriveVariantFinalCost,
  validateMarginPercent,
  deriveSuggestedSellingPrice,
  calcEstimatedProfit,
  calcEstimatedMargin,
  type ProfitType,
} from "@/lib/utils/cost-conversion";
import { formatBhd } from "@/lib/formatters/currency";
import type { CategoryRow, StaffRole } from "@/types/database";
import type { ProductWithRelations } from "@/types/app";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";

type ProductFormProps = {
  categories: CategoryRow[];
  product?: ProductWithRelations;
  userRole: StaffRole | null;
  /** Current INR → BHD rate from Settings → Exchange Rates (multiply direction), or null if
   *  no manager has set one yet — same source the New Product wizard uses, so both forms
   *  always agree on today's rate. */
  currentExchangeRate: number | null;
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
  importCostBhd: 0,
  status: PRODUCT_STATUSES.active,
} as const;

/** Per-variant fields that aren't part of the saved product schema — they only exist to
 *  drive the Price & Cost calculator (same split as the New Product wizard's WizardVariant:
 *  importCostInr/profitInput are form-only, converted to the schema's importCostBhd right
 *  before submit). Kept as a plain array parallel to useFieldArray's `fields`, indexed the
 *  same way, since RHF's own field.id isn't known until the hook runs. */
type VariantCostState = {
  importCostInr: number;
  profitInput: number;
};


/** Existing variants only ever store the converted BHD import cost — reverse it into INR
 *  (using the variant's own recorded rate) so the field starts populated with something
 *  sensible instead of 0 when a variant already has cost data. Purely a display starting
 *  point; saving always reconverts forward from whatever staff sees on screen. */
function reverseImportCostInr(variant: ProductWithRelations["variants"][number]): number {
  const bhd = variant.latest_additional_landed_cost_bhd;
  const rate = variant.latest_exchange_rate_to_bhd;
  if (!bhd || !rate || rate <= 0) return 0;
  return Math.round((bhd / rate) * 100) / 100;
}

function initialCostState(product?: ProductWithRelations): VariantCostState[] {
  if (!product || product.variants.length === 0) {
    return [{ importCostInr: 0, profitInput: 0 }];
  }
  return product.variants.map((v) => ({
    importCostInr: reverseImportCostInr(v),
    profitInput: 0,
  }));
}

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
      buyingPriceInr: Number(variant.latest_supplier_unit_cost_inr ?? 0),
      importCostBhd: 0,
      status: (["active", "inactive", "archived", "draft"].includes(variant.status)
        ? variant.status
        : "active") as "active" | "inactive" | "archived" | "draft",
    })),
    images: product.images.map((image) => ({
      id: image.id,
      variantId: image.variant_id,
      color: image.color,
      url: image.url,
      path: image.path,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    })),
  };
}

export function ProductForm({ categories, product, userRole, currentExchangeRate }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [showInvalidBanner, setShowInvalidBanner] = useState(false);
  const isEditing = Boolean(product);
  const canPublish = canPublishProducts(userRole);
  const canEnterCost = canEnterBuyingCost(userRole);
  const canViewProfit = canViewCostData(userRole);
  const canAdjustStock = canAdjustInventory(userRole);
  const hasEffectiveRate = currentExchangeRate !== null && currentExchangeRate > 0;

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: mapProduct(product),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const [costState, setCostState] = useState<VariantCostState[]>(() => initialCostState(product));
  const [profitType, setProfitType] = useState<ProfitType>("amount");

  // ── bulk apply (Price & Cost) ─────────────────────────────────────────────────
  const [bulkBuyingPriceInr, setBulkBuyingPriceInr] = useState(0);
  const [bulkImportCostInr, setBulkImportCostInr] = useState(0);
  const [bulkProfitInput, setBulkProfitInput] = useState(0);
  const [bulkMinStock, setBulkMinStock] = useState(0);
  const bulkMarginError = profitType === "margin" ? validateMarginPercent(bulkProfitInput) : null;

  function appendVariant() {
    append({ ...emptyVariant });
    setCostState((prev) => [...prev, { importCostInr: 0, profitInput: 0 }]);
  }

  function removeVariantAt(index: number) {
    remove(index);
    setCostState((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCostState(index: number, patch: Partial<VariantCostState>) {
    setCostState((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  /** Only non-zero bulk fields apply — same convention as the New Product wizard, so a
   *  blank bulk field never silently overwrites a value staff already customized per row. */
  function applyBulkToAll() {
    fields.forEach((_, index) => {
      const nextBuyingPriceInr =
        bulkBuyingPriceInr > 0 ? bulkBuyingPriceInr : form.getValues(`variants.${index}.buyingPriceInr`) || 0;
      const nextImportCostInr = bulkImportCostInr > 0 ? bulkImportCostInr : costState[index]?.importCostInr ?? 0;
      const nextProfitInput = bulkProfitInput > 0 ? bulkProfitInput : costState[index]?.profitInput ?? 0;

      form.setValue(`variants.${index}.buyingPriceInr`, nextBuyingPriceInr, { shouldDirty: true });
      if (bulkMinStock > 0) {
        form.setValue(`variants.${index}.minimumStock`, bulkMinStock, { shouldDirty: true });
      }
      updateCostState(index, { importCostInr: nextImportCostInr, profitInput: nextProfitInput });

      if (canViewProfit) {
        const finalCost = deriveVariantFinalCost(nextBuyingPriceInr, currentExchangeRate, nextImportCostInr);
        const marginError = profitType === "margin" ? validateMarginPercent(nextProfitInput) : null;
        const suggested =
          marginError === null ? deriveSuggestedSellingPrice(finalCost, profitType, nextProfitInput) : 0;
        if (suggested > 0) {
          form.setValue(`variants.${index}.regularSellingPriceBhd`, suggested, { shouldDirty: true });
          form.setValue(`variants.${index}.sellingPrice`, suggested, { shouldDirty: true });
        }
      }
    });
  }

  // ── save flow (review popup for staff who can view profit) ──────────────────
  const [pendingValues, setPendingValues] = useState<ProductInput | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successInfo, setSuccessInfo] = useState<SaveSuccessInfo | null>(null);

  // ── stock actions (Receive stock / Correct quantity) ─────────────────────────
  // Scoped to one already-saved variant at a time — looked up from `product` (the real,
  // persisted data) rather than form state, since stock changes must never go through the
  // product save form (see productVariantSchema / updateProduct's variant UPDATE payload,
  // which never writes stock_quantity for an existing variant).
  const [stockAction, setStockAction] = useState<{ type: "receive" | "correct"; variantId: string } | null>(
    null,
  );
  const activeStockVariant = product?.variants.find((v) => v.id === stockAction?.variantId) ?? null;

  function handleStockActionSuccess() {
    router.refresh();
  }

  function rowKeyFor(index: number, variant: ProductInput["variants"][number]): string {
    return variant.id ?? `new-${index}`;
  }

  function buildConfirmationRows(values: ProductInput): PriceConfirmationRow[] {
    return values.variants.map((variant, index) => {
      const cost = costState[index] ?? { importCostInr: 0, profitInput: 0 };
      const finalCostBhd = deriveVariantFinalCost(
        variant.buyingPriceInr ?? 0,
        currentExchangeRate,
        cost.importCostInr,
      );
      const marginError = profitType === "margin" ? validateMarginPercent(cost.profitInput) : null;
      const suggestedPriceBhd =
        marginError === null ? deriveSuggestedSellingPrice(finalCostBhd, profitType, cost.profitInput) : 0;
      const existing = product?.variants[index];
      return {
        key: rowKeyFor(index, variant),
        optionLabel: `${variant.color} / ${variant.size}`,
        buyingPriceInr: variant.buyingPriceInr ?? 0,
        importCostInr: cost.importCostInr,
        finalCostBhd,
        suggestedPriceBhd,
        oldPriceBhd: existing ? Number(existing.regular_selling_price_bhd ?? existing.selling_price) : undefined,
      };
    });
  }

  function doSubmit(values: ProductInput) {
    setFormError(null);
    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, values)
        : await createProductAction(values);

      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Product could not be saved.");
        return;
      }

      const newVariantRows = values.variants.filter((variant) => !variant.id);
      const websiteStatusChanged = product
        ? product.online_status !== values.onlineStatus || product.website_visible !== values.websiteVisible
        : values.onlineStatus !== "hidden" || values.websiteVisible;

      setSuccessInfo({
        productId: result.id,
        productName: values.name,
        variantCount: values.variants.length,
        newVariantCount: newVariantRows.length,
        startingStock: newVariantRows.reduce((sum, variant) => sum + (variant.stockQuantity || 0), 0),
        onlineStatus: values.onlineStatus,
        websiteVisible: values.websiteVisible,
        websiteStatusChanged,
        costChanged: values.variants.some((variant) => (variant.buyingPriceInr ?? 0) > 0),
        hasImages: values.images.length > 0,
      });
      router.refresh();
    });
  }

  function buildSubmitValues(values: ProductInput): ProductInput {
    return {
      ...values,
      openingCost:
        canEnterCost && hasEffectiveRate
          ? {
              buyingCurrency: "INR",
              buyingPricePerPiece: 0,
              exchangeRateToBhd: currentExchangeRate!,
              exchangeRateDate: new Date().toISOString().slice(0, 10),
              exchangeRateSource: "manual",
            }
          : null,
      variants: values.variants.map((variant, index) => ({
        ...variant,
        importCostBhd: deriveImportCostBhd(costState[index]?.importCostInr ?? 0, currentExchangeRate),
      })),
    };
  }

  /** react-hook-form's handleSubmit(onValid, onInvalid) second callback — runs when zod
   *  validation fails (e.g. a newly added variant is missing its color/size), so staff
   *  clicking Review & Save always get a clear response instead of the button silently
   *  doing nothing. Field-level messages already render next to each input via FieldError;
   *  this adds the top-level banner so a failure is never missed if the invalid field is
   *  off-screen. */
  function onInvalid() {
    setShowInvalidBanner(true);
  }

  function onReview(values: ProductInput) {
    setShowInvalidBanner(false);
    const submitValues = buildSubmitValues(values);

    if (!canViewProfit) {
      doSubmit(submitValues);
      return;
    }

    if (profitType === "margin") {
      const invalidIndex = submitValues.variants.findIndex((variant, index) => {
        const cost = costState[index] ?? { importCostInr: 0, profitInput: 0 };
        const finalCost = deriveVariantFinalCost(variant.buyingPriceInr ?? 0, currentExchangeRate, cost.importCostInr);
        return finalCost > 0 && validateMarginPercent(cost.profitInput) !== null;
      });
      if (invalidIndex >= 0) {
        setFormError(validateMarginPercent(costState[invalidIndex].profitInput));
        return;
      }
    }

    setFormError(null);
    setPendingValues(submitValues);
    setShowConfirm(true);
  }

  function handleConfirmSave(prices: Record<string, number>) {
    if (!pendingValues) return;
    const finalValues: ProductInput = {
      ...pendingValues,
      variants: pendingValues.variants.map((variant, index) => {
        const key = rowKeyFor(index, variant);
        const price = prices[key] ?? variant.regularSellingPriceBhd;
        return { ...variant, regularSellingPriceBhd: price, sellingPrice: price };
      }),
    };
    setShowConfirm(false);
    doSubmit(finalValues);
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onReview, onInvalid)}>
      {showInvalidBanner ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          Please fix the highlighted fields before saving.
        </p>
      ) : null}
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
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <CategorySelect
                  id="category"
                  categories={categories}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  currentCategoryName={product?.category?.name}
                />
              )}
            />
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
              Stock quantity is managed from Inventory / Receive Stock.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={appendVariant}>
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            Add variant
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const variantId = form.getValues(`variants.${index}.id`);
            const isNewVariant = isEditing && !variantId;
            const variantErrors = form.formState.errors.variants?.[index];
            // Real, persisted stock — never the possibly-unsaved form value — so the display
            // and the Receive stock / Correct quantity modals always agree with the database.
            const originalVariant = variantId ? product?.variants.find((v) => v.id === variantId) : undefined;
            return (
            <div key={field.id} className="space-y-3 rounded-md border bg-musiva-ivory p-4">
              <input type="hidden" {...form.register(`variants.${index}.id`)} />
              <input type="hidden" {...form.register(`variants.${index}.barcode`)} />
              {isNewVariant ? (
                <p className="rounded border border-musiva-info/25 bg-musiva-info/10 px-2 py-1 text-xs text-musiva-info">
                  New option. Save changes to create this variant.
                </p>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Variant SKU</Label>
                  <Input
                    {...form.register(`variants.${index}.variantSku`)}
                    placeholder="Auto-generated if left blank"
                  />
                  <FieldError message={variantErrors?.variantSku?.message} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input {...form.register(`variants.${index}.color`)} placeholder="Black" />
                  <FieldError message={variantErrors?.color?.message} />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input {...form.register(`variants.${index}.size`)} placeholder="M" />
                  <FieldError message={variantErrors?.size?.message} />
                </div>
                <div className="space-y-2">
                  <Label>{isNewVariant ? "Opening stock" : "Current stock"}</Label>
                  {isNewVariant ? (
                    <Input min={0} type="number" {...form.register(`variants.${index}.stockQuantity`)} />
                  ) : (
                    <>
                      {/* Stock is never edited through this form — see productVariantSchema /
                          updateProduct, which never writes stock_quantity for an existing
                          variant. This hidden field just keeps the field array's shape intact
                          for validation; its value is always the untouched original. */}
                      <input type="hidden" {...form.register(`variants.${index}.stockQuantity`)} />
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                        {originalVariant?.stock_quantity ?? 0} unit
                        {(originalVariant?.stock_quantity ?? 0) !== 1 ? "s" : ""}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Stock is managed through inventory actions.
                      </p>
                      {canAdjustStock && variantId ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setStockAction({ type: "receive", variantId })}
                          >
                            <PackagePlus aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                            Receive stock
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setStockAction({ type: "correct", variantId })}
                          >
                            <SlidersHorizontal aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                            Correct quantity
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select {...form.register(`variants.${index}.status`)}>
                    <option value={PRODUCT_STATUSES.active}>Active</option>
                    <option value={PRODUCT_STATUSES.inactive}>Inactive</option>
                    <option value={PRODUCT_STATUSES.archived}>Archived</option>
                  </Select>
                </div>
              </div>

              <VariantPriceCost
                index={index}
                form={form}
                cost={costState[index] ?? { importCostInr: 0, profitInput: 0 }}
                onCostChange={(patch) => updateCostState(index, patch)}
                canEnterCost={canEnterCost}
                canViewProfit={canViewProfit}
                profitType={profitType}
                exchangeRate={currentExchangeRate}
              />

              <div className="flex justify-end">
                <Button
                  disabled={fields.length === 1}
                  type="button"
                  variant="outline"
                  onClick={() => removeVariantAt(index)}
                >
                  <Trash2 aria-hidden className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
            );
          })}
          <FieldError message={form.formState.errors.variants?.message} />
        </CardContent>
      </Card>

      {canEnterCost && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Apply to all variants</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill any of these and click Apply — only non-zero fields are applied, so you can
              set just the ones you need.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bulk-buy-inr">Buying price India (INR)</Label>
                <Input
                  id="bulk-buy-inr"
                  min={0}
                  placeholder="1500.00"
                  step="0.01"
                  type="number"
                  value={bulkBuyingPriceInr || ""}
                  onChange={(e) => setBulkBuyingPriceInr(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-import-inr">Import cost India (INR)</Label>
                <Input
                  id="bulk-import-inr"
                  min={0}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={bulkImportCostInr || ""}
                  onChange={(e) => setBulkImportCostInr(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exchange rate</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {hasEffectiveRate
                    ? `1 INR = BHD ${Number(currentExchangeRate).toFixed(6)}`
                    : "Not set — see Settings"}
                </div>
              </div>
              {canViewProfit && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-profit">
                      Desired profit {profitType === "amount" ? "(BHD)" : "(%)"}
                    </Label>
                    <Input
                      id="bulk-profit"
                      min={0}
                      step={profitType === "amount" ? "0.001" : "0.1"}
                      type="number"
                      value={bulkProfitInput || ""}
                      onChange={(e) => setBulkProfitInput(Number(e.target.value) || 0)}
                    />
                    {bulkMarginError && <p className="text-xs text-destructive">{bulkMarginError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profit-type">Profit type</Label>
                    <Select
                      id="profit-type"
                      value={profitType}
                      onChange={(e) => setProfitType(e.target.value as ProfitType)}
                    >
                      <option value="amount">Profit amount (BHD)</option>
                      <option value="margin">Margin percentage (%)</option>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="bulk-min">Minimum stock</Label>
                <Input
                  id="bulk-min"
                  min={0}
                  placeholder="1"
                  type="number"
                  value={bulkMinStock || ""}
                  onChange={(e) => setBulkMinStock(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={applyBulkToAll}>
              Apply to all variants
            </Button>
          </CardContent>
        </Card>
      )}

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
          {isPending ? "Saving..." : canViewProfit ? "Review & save" : "Save product"}
        </Button>
      </div>

      {canViewProfit && pendingValues && (
        <PriceConfirmationDialog
          open={showConfirm}
          rows={buildConfirmationRows(pendingValues)}
          isSubmitting={isPending}
          onBack={() => setShowConfirm(false)}
          onConfirm={handleConfirmSave}
          title="Confirm price updates"
          confirmLabel="Save changes"
          confirmPendingLabel="Saving..."
          productName={pendingValues.name}
          websiteStatusChange={
            product &&
            (product.online_status !== pendingValues.onlineStatus ||
              product.website_visible !== pendingValues.websiteVisible)
              ? {
                  oldStatus: product.online_status,
                  newStatus: pendingValues.onlineStatus,
                  oldVisible: product.website_visible,
                  newVisible: pendingValues.websiteVisible,
                }
              : null
          }
        />
      )}

      {successInfo && (
        <ProductSaveSuccessDialog
          open={Boolean(successInfo)}
          info={successInfo}
          isEditing={isEditing}
          onViewProduct={() => {
            router.push(`/admin/products/${successInfo.productId}`);
          }}
          onBackToCatalog={() => {
            router.push("/admin/products");
          }}
          onContinueEditing={() => {
            setSuccessInfo(null);
          }}
        />
      )}

      {activeStockVariant && stockAction?.type === "receive" && (
        <ReceiveStockModal
          color={activeStockVariant.color}
          currentStock={activeStockVariant.stock_quantity}
          open={stockAction !== null}
          productName={product?.name ?? ""}
          size={activeStockVariant.size}
          variantId={activeStockVariant.id}
          onOpenChange={(next) => !next && setStockAction(null)}
          onSuccess={handleStockActionSuccess}
        />
      )}

      {activeStockVariant && stockAction?.type === "correct" && (
        <CorrectQuantityModal
          color={activeStockVariant.color}
          currentStock={activeStockVariant.stock_quantity}
          open={stockAction !== null}
          productName={product?.name ?? ""}
          size={activeStockVariant.size}
          variantId={activeStockVariant.id}
          onOpenChange={(next) => !next && setStockAction(null)}
          onSuccess={handleStockActionSuccess}
        />
      )}
    </form>
  );
}

// ── Price & Cost — per variant ────────────────────────────────────────────────

function VariantPriceCost({
  index,
  form,
  cost,
  onCostChange,
  canEnterCost,
  canViewProfit,
  profitType,
  exchangeRate,
}: {
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  cost: VariantCostState;
  onCostChange: (patch: Partial<VariantCostState>) => void;
  canEnterCost: boolean;
  canViewProfit: boolean;
  profitType: ProfitType;
  exchangeRate: number | null;
}) {
  const buyingPriceInr = Number(form.watch(`variants.${index}.buyingPriceInr`)) || 0;
  const currentPriceBhd = Number(form.watch(`variants.${index}.regularSellingPriceBhd`)) || 0;

  if (!canEnterCost) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Selling price / Final customer price (BHD)</Label>
          <Input
            min={0}
            step="0.001"
            type="number"
            {...form.register(`variants.${index}.regularSellingPriceBhd`)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = Number(e.target.value) || 0;
              form.setValue(`variants.${index}.regularSellingPriceBhd`, value);
              form.setValue(`variants.${index}.sellingPrice`, value);
            }}
          />
        </div>
      </div>
    );
  }

  const finalCostBhd = deriveVariantFinalCost(buyingPriceInr, exchangeRate, cost.importCostInr);
  const marginError = profitType === "margin" ? validateMarginPercent(cost.profitInput) : null;
  const suggestedPriceBhd =
    marginError === null ? deriveSuggestedSellingPrice(finalCostBhd, profitType, cost.profitInput) : 0;
  const profit =
    canViewProfit && finalCostBhd > 0 && currentPriceBhd > 0
      ? calcEstimatedProfit(currentPriceBhd, finalCostBhd)
      : null;
  const margin =
    canViewProfit && finalCostBhd > 0 && currentPriceBhd > 0
      ? calcEstimatedMargin(currentPriceBhd, finalCostBhd)
      : null;
  const belowCost = finalCostBhd > 0 && currentPriceBhd > 0 && currentPriceBhd < finalCostBhd;

  return (
    <div className="space-y-2 border-t border-dashed border-musiva-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-musiva-gold">Price &amp; Cost</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label className="text-[11px]">Buy India (INR)</Label>
          <Input
            min={0}
            step="0.01"
            type="number"
            {...form.register(`variants.${index}.buyingPriceInr`)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px]">Import India (INR)</Label>
          <Input
            min={0}
            step="0.01"
            type="number"
            value={cost.importCostInr || ""}
            onChange={(e) => onCostChange({ importCostInr: Number(e.target.value) || 0 })}
          />
        </div>
        {canViewProfit ? (
          <div className="space-y-2">
            <Label className="text-[11px]">
              {profitType === "amount" ? "Profit (BHD)" : "Margin (%)"}
            </Label>
            <Input
              min={0}
              step={profitType === "amount" ? "0.001" : "0.1"}
              type="number"
              value={cost.profitInput || ""}
              onChange={(e) => onCostChange({ profitInput: Number(e.target.value) || 0 })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-[11px]">Selling price / Final customer price (BHD)</Label>
            <Input
              min={0}
              step="0.001"
              type="number"
              {...form.register(`variants.${index}.regularSellingPriceBhd`)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = Number(e.target.value) || 0;
                form.setValue(`variants.${index}.regularSellingPriceBhd`, value);
                form.setValue(`variants.${index}.sellingPrice`, value);
              }}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-[11px]">Final Bahrain cost (BHD)</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-muted px-2 text-xs text-muted-foreground">
            {finalCostBhd > 0 ? formatBhd(finalCostBhd) : "Not recorded"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          Current price:{" "}
          <span className="font-medium text-foreground">{formatBhd(currentPriceBhd)}</span>
        </span>
        {canViewProfit && suggestedPriceBhd > 0 && (
          <span>
            Suggested price:{" "}
            <span className="font-medium text-foreground">{formatBhd(suggestedPriceBhd)}</span>
          </span>
        )}
        {profit !== null && margin !== null && (
          <span>
            Profit: <span className="font-medium text-foreground">{formatBhd(profit)}</span>
            {margin !== null ? ` · Margin ${margin.toFixed(1)}%` : ""}
          </span>
        )}
        {marginError && <span className="text-destructive">{marginError}</span>}
      </div>

      {belowCost && (
        <p className="rounded border border-musiva-warning/30 bg-musiva-warning/10 px-2 py-1 text-xs text-musiva-warning-foreground">
          Selling price is below final cost.
        </p>
      )}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
