"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ImageOff, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateProductSku } from "@/lib/utils/sku";
import { generateVariants, type GeneratedVariant } from "@/lib/utils/variant-generator";
import { createProductAction } from "@/app/admin/products/actions";
import { uploadProductImageAction } from "@/app/admin/products/image-actions";
import { formatBhd } from "@/lib/formatters/currency";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/types/database";

type ProductWizardProps = {
  categories: CategoryRow[];
};

const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const IMAGE_ACCEPT_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// ── types ──────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

type Step1Data = {
  name: string;
  categoryId: string;
  collection: string;
  description: string;
  material: string;
  careInstructions: string;
  sku: string;
};

type Step2Data = {
  colors: string[];
  sizes: string[];
};

type Step3Data = {
  variants: GeneratedVariant[];
};

// ── chip input ─────────────────────────────────────────────────────────────────

function ChipInput({
  label,
  hint,
  chips,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  hint?: string;
  chips: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const trimmed = input.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={commit}>
          <Plus aria-hidden className="h-4 w-4" />
          <span className="sr-only">Add</span>
        </Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1.5 rounded-full border border-musiva-border bg-musiva-ivory px-3 py-1 text-sm font-medium text-musiva-plum"
            >
              {chip}
              <button
                aria-label={`Remove ${chip}`}
                className="rounded-full text-muted-foreground hover:text-destructive"
                type="button"
                onClick={() => onRemove(chip)}
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: WizardStep; steps: string[] }) {
  return (
    <nav aria-label="Form progress" className="flex items-center gap-0">
      {steps.map((label, i) => {
        const step = (i + 1) as WizardStep;
        const done = step < current;
        const active = step === current;

        return (
          <div key={label} className="flex items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                done
                  ? "bg-musiva-plum text-white"
                  : active
                  ? "border-2 border-musiva-plum text-musiva-plum"
                  : "border-2 border-musiva-border text-muted-foreground",
              )}
            >
              {done ? <Check aria-hidden className="h-4 w-4" /> : step}
            </div>
            <span
              className={cn(
                "ml-2 hidden text-sm font-medium sm:block",
                active ? "text-musiva-plum" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight aria-hidden className="mx-3 h-4 w-4 text-musiva-border" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── main wizard ────────────────────────────────────────────────────────────────

export function ProductWizard({ categories }: ProductWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // step 4 — image upload after product creation
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploading, startImageTransition] = useTransition();
  const imageInputRef = useRef<HTMLInputElement>(null);

  // step data
  const [step1, setStep1] = useState<Step1Data>({
    name: "",
    categoryId: "",
    collection: "",
    description: "",
    material: "",
    careInstructions: "",
    sku: "",
  });
  const [step2, setStep2] = useState<Step2Data>({ colors: [], sizes: [] });
  const [step3, setStep3] = useState<Step3Data>({ variants: [] });

  // bulk setter inputs (controlled)
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkMinStock, setBulkMinStock] = useState<number>(1);

  // ── step 1 ───────────────────────────────────────────────────────────────────

  function update1<K extends keyof Step1Data>(key: K, value: Step1Data[K]) {
    setStep1((prev) => ({ ...prev, [key]: value }));
  }

  function goToStep2() {
    if (!step1.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    setFormError(null);
    setStep(2);
  }

  // ── step 2 ───────────────────────────────────────────────────────────────────

  const addColor = useCallback(
    (color: string) => setStep2((prev) => ({ ...prev, colors: [...prev.colors, color] })),
    [],
  );
  const removeColor = useCallback(
    (color: string) =>
      setStep2((prev) => ({ ...prev, colors: prev.colors.filter((c) => c !== color) })),
    [],
  );
  const addSize = useCallback(
    (size: string) => setStep2((prev) => ({ ...prev, sizes: [...prev.sizes, size] })),
    [],
  );
  const removeSize = useCallback(
    (size: string) =>
      setStep2((prev) => ({ ...prev, sizes: prev.sizes.filter((s) => s !== size) })),
    [],
  );

  function goToStep3() {
    if (step2.colors.length === 0) {
      setFormError("Add at least one color.");
      return;
    }
    if (step2.sizes.length === 0) {
      setFormError("Add at least one size.");
      return;
    }
    setFormError(null);
    const productSku = step1.sku.trim() || generateProductSku(step1.name);
    const generated = generateVariants(productSku, step2.colors, step2.sizes, {
      regularSellingPriceBhd: 0,
      stockQuantity: 0,
      minimumStock: bulkMinStock,
    });
    setStep3({ variants: generated });
    setStep(3);
  }

  // ── step 3 ───────────────────────────────────────────────────────────────────

  function removeVariant(color: string, size: string) {
    setStep3((prev) => ({
      variants: prev.variants.filter((v) => !(v.color === color && v.size === size)),
    }));
  }

  function updateVariantField(
    color: string,
    size: string,
    field: "regularSellingPriceBhd" | "stockQuantity",
    value: number,
  ) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size
          ? {
              ...v,
              [field]: value,
              ...(field === "regularSellingPriceBhd" ? { sellingPrice: value } : {}),
            }
          : v,
      ),
    }));
  }

  function applyBulkPrice() {
    setStep3((prev) => ({
      variants: prev.variants.map((v) => ({
        ...v,
        regularSellingPriceBhd: bulkPrice,
        sellingPrice: bulkPrice,
      })),
    }));
  }

  function applyBulkMinStock() {
    setStep3((prev) => ({
      variants: prev.variants.map((v) => ({ ...v, minimumStock: bulkMinStock })),
    }));
  }

  // ── submit (create product, then move to image upload step) ─────────────────

  function handleSubmit() {
    if (step3.variants.length === 0) {
      setFormError("At least one size/color option is required.");
      return;
    }
    setFormError(null);
    const productSku = step1.sku.trim() || generateProductSku(step1.name);

    startTransition(async () => {
      const result = await createProductAction({
        name: step1.name.trim(),
        sku: productSku,
        categoryId: step1.categoryId || null,
        collection: step1.collection.trim() || null,
        description: step1.description.trim() || null,
        material: step1.material.trim() || null,
        careInstructions: step1.careInstructions.trim() || null,
        status: "active",
        variants: step3.variants.map((v) => ({
          variantSku: v.variantSku,
          barcode: null,
          color: v.color,
          size: v.size,
          costPrice: 0,
          sellingPrice: v.regularSellingPriceBhd,
          discountPrice: null,
          regularSellingPriceBhd: v.regularSellingPriceBhd,
          discountPriceBhd: null,
          discountStartAt: null,
          discountEndAt: null,
          stockQuantity: v.stockQuantity,
          minimumStock: v.minimumStock,
          status: "active",
        })),
        images: [],
      });

      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Product could not be created. Please try again.");
        return;
      }

      setCreatedProductId(result.id);
      setStep(4);
    });
  }

  // ── step 4 — image ───────────────────────────────────────────────────────────

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageError(null);

    if (!file) {
      clearImageSelection();
      return;
    }
    if (!IMAGE_ACCEPT_MIME.includes(file.type)) {
      setImageError("Only JPEG, PNG, and WebP images are accepted.");
      clearImageSelection();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(
        `Image must be ${MAX_IMAGE_MB} MB or smaller. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      );
      clearImageSelection();
      return;
    }
    if (file.size === 0) {
      setImageError("The selected file is empty.");
      clearImageSelection();
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImageSelection() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleImageUpload() {
    if (!imageFile || !createdProductId) return;
    setImageError(null);

    startImageTransition(async () => {
      const fd = new FormData();
      fd.append("file", imageFile);
      const result = await uploadProductImageAction(createdProductId, fd);

      if (!result.ok) {
        setImageError(result.error ?? "Upload failed. Please try again.");
        return;
      }

      router.push(`/admin/products/${createdProductId}`);
      router.refresh();
    });
  }

  function skipImageAndFinish() {
    router.push(`/admin/products/${createdProductId}`);
    router.refresh();
  }

  const STEPS = ["Basic details", "Colors & sizes", "Price & stock", "Add image"];
  const minPrice =
    step3.variants.length > 0
      ? Math.min(...step3.variants.map((v) => v.regularSellingPriceBhd))
      : null;

  return (
    <div className="space-y-6">
      <StepIndicator current={step} steps={STEPS} />

      {/* ── Step 1 — Basic details ────────────────────────────────── */}
      {step === 1 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Basic details</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with the product name and category. Everything else is optional.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">
                  Product name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Satin Dress"
                  value={step1.name}
                  onChange={(e) => update1("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={step1.categoryId}
                  onChange={(e) => update1("categoryId", e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection">Collection (optional)</Label>
                <Input
                  id="collection"
                  placeholder="Ramadan Edit"
                  value={step1.collection}
                  onChange={(e) => update1("collection", e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="A short description visible on the invoice."
                  rows={3}
                  value={step1.description}
                  onChange={(e) => update1("description", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="material">Material (optional)</Label>
                <Input
                  id="material"
                  placeholder="Silk blend"
                  value={step1.material}
                  onChange={(e) => update1("material", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="care">Care instructions (optional)</Label>
                <Input
                  id="care"
                  placeholder="Dry clean only"
                  value={step1.careInstructions}
                  onChange={(e) => update1("careInstructions", e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-musiva-border">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-musiva-plum"
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Advanced options</span>
                <ChevronRight
                  aria-hidden
                  className={cn("h-4 w-4 transition-transform", showAdvanced ? "rotate-90" : "")}
                />
              </button>
              {showAdvanced && (
                <div className="space-y-2 border-t border-dashed border-musiva-border px-4 pb-4 pt-3">
                  <Label htmlFor="sku">Product SKU (auto-generated if blank)</Label>
                  <Input
                    id="sku"
                    placeholder={step1.name ? generateProductSku(step1.name) : "MSV-…"}
                    value={step1.sku}
                    onChange={(e) => update1("sku", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-generate from the product name.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2 — Colors and sizes ─────────────────────────────── */}
      {step === 2 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Colors and sizes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Add colors and sizes. All combinations are generated automatically — you can remove
              any you don&apos;t need in the next step.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ChipInput
              hint='Type a color and press Enter or "+" to add it.'
              chips={step2.colors}
              label="Colors"
              placeholder="e.g. Black, Beige, Rose"
              onAdd={addColor}
              onRemove={removeColor}
            />
            <ChipInput
              hint='Type a size and press Enter or "+" to add it.'
              chips={step2.sizes}
              label="Sizes"
              placeholder="e.g. XS, S, M, L, XL"
              onAdd={addSize}
              onRemove={removeSize}
            />

            {step2.colors.length > 0 && step2.sizes.length > 0 && (
              <div className="rounded-md bg-musiva-ivory p-4">
                <p className="text-sm font-medium text-musiva-plum">
                  {step2.colors.length * step2.sizes.length} option
                  {step2.colors.length * step2.sizes.length !== 1 ? "s" : ""} will be created:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step2.colors.flatMap((color) =>
                    step2.sizes.map((size) => (
                      <span
                        key={`${color}-${size}`}
                        className="rounded border border-musiva-border bg-white px-2 py-1 text-xs text-musiva-plum"
                      >
                        {color} / {size}
                      </span>
                    )),
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3 — Price and starting stock ────────────────────── */}
      {step === 3 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Price and starting stock</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the selling price and starting quantity. Use the bulk setters to fill all options
              at once, then adjust individually.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 rounded-md bg-musiva-ivory p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-price">Set selling price for all (BHD)</Label>
                <div className="flex gap-2">
                  <Input
                    id="bulk-price"
                    min={0}
                    placeholder="0.000"
                    step="0.001"
                    type="number"
                    value={bulkPrice || ""}
                    onChange={(e) => setBulkPrice(Number(e.target.value) || 0)}
                  />
                  <Button type="button" variant="outline" onClick={applyBulkPrice}>
                    Apply all
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-min">Low-stock alert at (units, all)</Label>
                <div className="flex gap-2">
                  <Input
                    id="bulk-min"
                    min={0}
                    placeholder="1"
                    type="number"
                    value={bulkMinStock}
                    onChange={(e) => setBulkMinStock(Number(e.target.value) || 1)}
                  />
                  <Button type="button" variant="outline" onClick={applyBulkMinStock}>
                    Apply all
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {step3.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All options removed. Go back to step 2 to add colors and sizes.
                </p>
              ) : (
                step3.variants.map((v) => (
                  <div
                    key={`${v.color}-${v.size}`}
                    className="grid items-end gap-3 rounded-md border border-musiva-border bg-white p-4 sm:grid-cols-[1fr_140px_140px_40px]"
                  >
                    <div>
                      <p className="font-medium text-musiva-plum">
                        {v.color} / {v.size}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.variantSku}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Selling price (BHD)</Label>
                      <Input
                        min={0}
                        step="0.001"
                        type="number"
                        value={v.regularSellingPriceBhd || ""}
                        onChange={(e) =>
                          updateVariantField(
                            v.color,
                            v.size,
                            "regularSellingPriceBhd",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Starting quantity</Label>
                      <Input
                        min={0}
                        type="number"
                        value={v.stockQuantity}
                        onChange={(e) =>
                          updateVariantField(
                            v.color,
                            v.size,
                            "stockQuantity",
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                      />
                    </div>
                    <button
                      aria-label={`Remove ${v.color} / ${v.size}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-musiva-border text-muted-foreground hover:border-destructive hover:text-destructive"
                      type="button"
                      onClick={() => removeVariant(v.color, v.size)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {step3.variants.length > 0 && (
              <div className="rounded-md bg-musiva-ivory p-4 text-sm">
                <p className="font-medium text-musiva-plum">
                  {step3.variants.length} option{step3.variants.length !== 1 ? "s" : ""}
                  {" · "}
                  {step3.variants.reduce((s, v) => s + v.stockQuantity, 0)} units starting stock
                  {minPrice !== null ? ` · from ${formatBhd(minPrice)}` : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 4 — Add image (optional) ────────────────────────── */}
      {step === 4 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Add product image</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. You can add or change the image at any time from the product page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {imagePreview ? (
              <div className="relative mx-auto w-fit">
                <img
                  alt="Preview"
                  className="h-52 w-40 rounded-lg border border-musiva-border object-cover object-top"
                  src={imagePreview}
                />
                <button
                  aria-label="Remove selected image"
                  className="absolute right-0 top-0 rounded-full bg-white p-1 shadow hover:bg-red-50"
                  type="button"
                  onClick={clearImageSelection}
                >
                  <X aria-hidden className="h-4 w-4 text-destructive" />
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">{imageFile?.name}</p>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-musiva-border bg-musiva-blush/20 px-4 py-10 text-center transition-colors hover:border-musiva-plum/40 hover:bg-musiva-blush/40">
                <ImageOff aria-hidden className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-sm font-medium text-musiva-plum">Choose image</span>
                <span className="text-xs text-muted-foreground">
                  JPEG · PNG · WebP · max {MAX_IMAGE_MB} MB
                </span>
                <input
                  ref={imageInputRef}
                  accept={IMAGE_ACCEPT}
                  className="sr-only"
                  type="file"
                  onChange={handleImageFileChange}
                />
              </label>
            )}
            {imageError && (
              <p className="text-sm text-destructive">{imageError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {formError ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-between gap-3">
        {step < 4 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormError(null);
              if (step === 1) router.back();
              else setStep((s) => (s - 1) as WizardStep);
            }}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
        )}

        <div className="flex gap-3 ml-auto">
          {step < 3 && (
            <Button
              type="button"
              onClick={() => {
                if (step === 1) goToStep2();
                else goToStep3();
              }}
            >
              Next
              <ChevronRight aria-hidden className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button
              disabled={isPending || step3.variants.length === 0}
              type="button"
              onClick={handleSubmit}
            >
              {isPending ? "Creating…" : "Create product"}
            </Button>
          )}
          {step === 4 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={skipImageAndFinish}
                disabled={imageUploading}
              >
                Skip for now
              </Button>
              {imageFile && (
                <Button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={imageUploading}
                >
                  {imageUploading ? (
                    <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload aria-hidden className="mr-2 h-4 w-4" />
                  )}
                  Upload &amp; finish
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
