"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ImageOff,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
import {
  convertToBhd,
  calcLandedCost,
  calcEstimatedProfit,
  calcEstimatedMargin,
  roundBhd,
  formatInr,
} from "@/lib/utils/cost-conversion";
import { cn } from "@/lib/utils";
import { canEnterBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import type { CategoryRow, StaffRole } from "@/types/database";

type ProductWizardProps = {
  categories: CategoryRow[];
  userRole: StaffRole | null;
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

/** Extension of GeneratedVariant that carries per-variant buying price and cost details. */
type WizardVariant = GeneratedVariant & {
  buyingPriceInr: number;
  landedCostOverrideBhd: number | null;
  showCostDetails: boolean;
};

type OpeningCostState = {
  buyingCurrency: string;
  buyingPricePerPiece: number;
  exchangeRateToBhd: number;
  exchangeRateDate: string;
  exchangeRateSource: "manual" | "bank" | "other";
  extraImportCostBhd: number;
};

type Step3Data = {
  variants: WizardVariant[];
};

// ── derived cost calculations ─────────────────────────────────────────────────

function deriveVariantConvertedCost(buyingPriceInr: number, exchangeRateToBhd: number): number {
  if (!buyingPriceInr || !exchangeRateToBhd) return 0;
  return roundBhd(convertToBhd(buyingPriceInr, exchangeRateToBhd));
}

function deriveVariantLandedCost(
  buyingPriceInr: number,
  exchangeRateToBhd: number,
  extraImportCostBhd: number,
): number {
  const converted = deriveVariantConvertedCost(buyingPriceInr, exchangeRateToBhd);
  if (!converted) return 0;
  return roundBhd(calcLandedCost(converted, extraImportCostBhd));
}

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

// ── profit badge ───────────────────────────────────────────────────────────────

function ProfitBadge({ profit, margin }: { profit: number; margin: number | null }) {
  const positive = profit >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        positive
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {positive ? "+" : ""}
      {formatBhd(profit)}
      {margin !== null ? ` · ${margin.toFixed(1)}%` : ""}
    </span>
  );
}

// ── main wizard ────────────────────────────────────────────────────────────────

export function ProductWizard({ categories, userRole }: ProductWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Role-based cost permissions.
  const canEnterCost = canEnterBuyingCost(userRole);
  const canViewProfit = canViewCostData(userRole);
  const [openingCost, setOpeningCost] = useState<OpeningCostState>({
    buyingCurrency: "INR",
    buyingPricePerPiece: 0,
    exchangeRateToBhd: 0,
    exchangeRateDate: "",
    exchangeRateSource: "manual",
    extraImportCostBhd: 0,
  });

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

  // bulk setter inputs
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkBuyingPriceInr, setBulkBuyingPriceInr] = useState<number>(0);
  const [bulkMinStock, setBulkMinStock] = useState<number>(1);
  const [bulkStartingQty, setBulkStartingQty] = useState<number>(0);

  // ── derived values ───────────────────────────────────────────────────────────

  const bulkConvertedCost = deriveVariantConvertedCost(
    bulkBuyingPriceInr,
    openingCost.exchangeRateToBhd,
  );
  const bulkLandedCost = deriveVariantLandedCost(
    bulkBuyingPriceInr,
    openingCost.exchangeRateToBhd,
    openingCost.extraImportCostBhd,
  );
  const showBulkPreview = canEnterCost && bulkConvertedCost > 0;

  // ── cost field updater ───────────────────────────────────────────────────────

  function updateCost<K extends keyof OpeningCostState>(key: K, value: OpeningCostState[K]) {
    setOpeningCost((prev) => ({ ...prev, [key]: value }));
  }

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
    setStep3({
      variants: generated.map((v) => ({
        ...v,
        buyingPriceInr: 0,
        landedCostOverrideBhd: null,
        showCostDetails: false,
      })),
    });
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
    field: "regularSellingPriceBhd" | "stockQuantity" | "minimumStock",
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

  function updateVariantBuyingPrice(color: string, size: string, value: number) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size ? { ...v, buyingPriceInr: value } : v,
      ),
    }));
  }

  function updateVariantCostOverride(color: string, size: string, value: number | null) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size
          ? { ...v, landedCostOverrideBhd: value }
          : v,
      ),
    }));
  }

  function toggleCostDetails(color: string, size: string) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size
          ? { ...v, showCostDetails: !v.showCostDetails }
          : v,
      ),
    }));
  }

  function applyBulkAll() {
    setStep3((prev) => ({
      variants: prev.variants.map((v) => ({
        ...v,
        ...(bulkPrice > 0
          ? { regularSellingPriceBhd: bulkPrice, sellingPrice: bulkPrice }
          : {}),
        ...(bulkBuyingPriceInr > 0 ? { buyingPriceInr: bulkBuyingPriceInr } : {}),
        ...(bulkMinStock > 0 ? { minimumStock: bulkMinStock } : {}),
        ...(bulkStartingQty > 0 ? { stockQuantity: bulkStartingQty } : {}),
      })),
    }));
  }

  // ── submit ───────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (step3.variants.length === 0) {
      setFormError("At least one size/color option is required.");
      return;
    }

    // Validate cost fields when any variant has a buying price.
    const hasAnyCost = canEnterCost && step3.variants.some((v) => v.buyingPriceInr > 0);
    if (hasAnyCost) {
      if (!openingCost.exchangeRateToBhd || openingCost.exchangeRateToBhd <= 0) {
        setFormError("Exchange rate is required when a buying price is entered.");
        return;
      }
      if (!openingCost.exchangeRateDate) {
        setFormError("Exchange rate date is required.");
        return;
      }
      if (openingCost.extraImportCostBhd < 0) {
        setFormError("Import cost cannot be negative.");
        return;
      }
    }

    setFormError(null);
    const productSku = step1.sku.trim() || generateProductSku(step1.name);

    // Include opening cost only when at least one variant has a buying price.
    const sendOpeningCost =
      hasAnyCost && openingCost.exchangeRateToBhd > 0
        ? {
            buyingCurrency: openingCost.buyingCurrency,
            buyingPricePerPiece: 0,
            exchangeRateToBhd: openingCost.exchangeRateToBhd,
            exchangeRateDate: openingCost.exchangeRateDate,
            exchangeRateSource: openingCost.exchangeRateSource,
            extraImportCostBhd: openingCost.extraImportCostBhd,
          }
        : null;

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
        openingCost: sendOpeningCost,
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
          buyingPriceInr: v.buyingPriceInr,
          landedCostOverrideBhd: v.landedCostOverrideBhd,
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
            <CardTitle>Price &amp; starting stock</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {canEnterCost
                ? "Fill the shared fields and click “Apply to all options”, then fine-tune individual options below."
                : "Set the selling price and starting quantity. Use the bulk setter to fill all options at once, then adjust individually."}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Bulk setters (cost-entry users) ──────────────────── */}
            {canEnterCost ? (
              <div className="space-y-4 rounded-md bg-musiva-ivory p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-price">Selling price (BHD)</Label>
                    <Input
                      id="bulk-price"
                      min={0}
                      placeholder="0.000"
                      step="0.001"
                      type="number"
                      value={bulkPrice || ""}
                      onChange={(e) => setBulkPrice(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-buy-inr">Buying price (INR)</Label>
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
                    <Label htmlFor="exchange-rate">Exchange rate (1 INR = ? BHD)</Label>
                    <Input
                      id="exchange-rate"
                      min={0}
                      placeholder="0.004520"
                      step="0.000001"
                      type="number"
                      value={openingCost.exchangeRateToBhd || ""}
                      onChange={(e) =>
                        updateCost("exchangeRateToBhd", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="import-cost">Import cost per piece (BHD)</Label>
                    <Input
                      id="import-cost"
                      min={0}
                      placeholder="0.000"
                      step="0.001"
                      type="number"
                      value={openingCost.extraImportCostBhd || ""}
                      onChange={(e) =>
                        updateCost("extraImportCostBhd", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-min">Low-stock alert (units)</Label>
                    <Input
                      id="bulk-min"
                      min={0}
                      placeholder="1"
                      type="number"
                      value={bulkMinStock || ""}
                      onChange={(e) => setBulkMinStock(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-qty">Starting quantity</Label>
                    <Input
                      id="bulk-qty"
                      min={0}
                      placeholder="0"
                      type="number"
                      value={bulkStartingQty || ""}
                      onChange={(e) =>
                        setBulkStartingQty(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                {/* Rate date + source — shown once exchange rate is entered */}
                {openingCost.exchangeRateToBhd > 0 && (
                  <div className="grid gap-4 border-t border-musiva-border/40 pt-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rate-date">Rate date</Label>
                      <Input
                        id="rate-date"
                        type="date"
                        value={openingCost.exchangeRateDate}
                        onChange={(e) => updateCost("exchangeRateDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate-source">Rate source</Label>
                      <Select
                        id="rate-source"
                        value={openingCost.exchangeRateSource}
                        onChange={(e) =>
                          updateCost(
                            "exchangeRateSource",
                            e.target.value as "manual" | "bank" | "other",
                          )
                        }
                      >
                        <option value="manual">Manual entry</option>
                        <option value="bank">Bank rate</option>
                        <option value="other">Other</option>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <Button type="button" variant="outline" onClick={applyBulkAll}>
                    Apply to all options
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Only non-zero fields are applied. Future purchases use Purchases → New Purchase.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Bulk setters (view-only users) ─────────────────── */
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
                    <Button type="button" variant="outline" onClick={applyBulkAll}>
                      Apply all
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-min">Low-stock alert (units, all)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="bulk-min"
                      min={0}
                      placeholder="1"
                      type="number"
                      value={bulkMinStock || ""}
                      onChange={(e) => setBulkMinStock(Number(e.target.value) || 1)}
                    />
                    <Button type="button" variant="outline" onClick={applyBulkAll}>
                      Apply all
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Live conversion preview (bulk) ───────────────────── */}
            {showBulkPreview && (
              <div className="rounded-md border border-musiva-border bg-musiva-ivory px-4 py-3 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-musiva-gold">
                  Cost preview (bulk)
                </p>
                <div className="grid gap-1 tabular-nums sm:grid-cols-2">
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Buying price</span>
                    <span className="font-medium text-foreground">
                      {formatInr(bulkBuyingPriceInr)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Exchange rate</span>
                    <span className="font-medium text-foreground">
                      1 INR = BHD {openingCost.exchangeRateToBhd.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Converted cost</span>
                    <span className="font-medium text-foreground">
                      {formatBhd(bulkConvertedCost)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Import cost</span>
                    <span className="font-medium text-foreground">
                      {formatBhd(openingCost.extraImportCostBhd)}
                    </span>
                  </div>
                  <div className="col-span-full mt-1 flex justify-between gap-4 border-t border-musiva-border pt-2">
                    <span className="font-semibold text-musiva-plum">Landed cost</span>
                    <span className="font-semibold text-musiva-plum">
                      {formatBhd(bulkLandedCost)}
                    </span>
                  </div>
                  {canViewProfit && bulkPrice > 0 && bulkLandedCost > 0 && (
                    <div className="col-span-full flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">Est. profit:</span>
                      <ProfitBadge
                        margin={calcEstimatedMargin(bulkPrice, bulkLandedCost)}
                        profit={calcEstimatedProfit(bulkPrice, bulkLandedCost)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Variant rows ──────────────────────────────────────── */}
            <div className="space-y-3">
              {step3.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All options removed. Go back to step 2 to add colors and sizes.
                </p>
              ) : (
                step3.variants.map((v) => {
                  const vConverted = deriveVariantConvertedCost(
                    v.buyingPriceInr,
                    openingCost.exchangeRateToBhd,
                  );
                  const vLanded = vConverted > 0
                    ? deriveVariantLandedCost(
                        v.buyingPriceInr,
                        openingCost.exchangeRateToBhd,
                        openingCost.extraImportCostBhd,
                      )
                    : 0;
                  const effectiveLanded =
                    v.landedCostOverrideBhd != null
                      ? v.landedCostOverrideBhd
                      : vLanded > 0
                      ? vLanded
                      : null;
                  const profit =
                    canViewProfit && effectiveLanded !== null && v.regularSellingPriceBhd > 0
                      ? calcEstimatedProfit(v.regularSellingPriceBhd, effectiveLanded)
                      : null;
                  const margin =
                    canViewProfit && effectiveLanded !== null && v.regularSellingPriceBhd > 0
                      ? calcEstimatedMargin(v.regularSellingPriceBhd, effectiveLanded)
                      : null;
                  const hasCostForVariant = canEnterCost && vConverted > 0;

                  return (
                    <div
                      key={`${v.color}-${v.size}`}
                      className="rounded-md border border-musiva-border bg-white"
                    >
                      {/* Main row */}
                      {canEnterCost ? (
                        <div className="grid items-end gap-2 p-3 sm:grid-cols-[1fr_100px_100px_64px_64px_32px_28px]">
                          {/* Name + SKU + profit */}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-musiva-plum">
                              {v.color} / {v.size}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {v.variantSku}
                            </p>
                            {profit !== null && margin !== null && (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">Profit:</span>
                                <ProfitBadge margin={margin} profit={profit} />
                              </div>
                            )}
                          </div>
                          {/* Selling price */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">Sell (BHD)</Label>
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
                          {/* Buying price INR */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">Buy (INR)</Label>
                            <Input
                              min={0}
                              step="0.01"
                              type="number"
                              value={v.buyingPriceInr || ""}
                              onChange={(e) =>
                                updateVariantBuyingPrice(
                                  v.color,
                                  v.size,
                                  Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                          {/* Starting qty */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">Qty</Label>
                            <Input
                              min={0}
                              type="number"
                              value={v.stockQuantity || ""}
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
                          {/* Min stock */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">Min</Label>
                            <Input
                              min={0}
                              type="number"
                              value={v.minimumStock}
                              onChange={(e) =>
                                updateVariantField(
                                  v.color,
                                  v.size,
                                  "minimumStock",
                                  Math.max(0, Number(e.target.value) || 0),
                                )
                              }
                            />
                          </div>
                          {/* Trash */}
                          <button
                            aria-label={`Remove ${v.color} / ${v.size}`}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-musiva-border text-muted-foreground hover:border-destructive hover:text-destructive"
                            type="button"
                            onClick={() => removeVariant(v.color, v.size)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </button>
                          {/* Expand toggle */}
                          <button
                            aria-label={
                              v.showCostDetails
                                ? `Hide cost details for ${v.color} / ${v.size}`
                                : `Show cost details for ${v.color} / ${v.size}`
                            }
                            className="flex h-9 w-7 items-center justify-center rounded text-muted-foreground hover:text-musiva-plum"
                            type="button"
                            onClick={() => toggleCostDetails(v.color, v.size)}
                          >
                            <ChevronDown
                              aria-hidden
                              className={cn(
                                "h-4 w-4 transition-transform",
                                v.showCostDetails ? "rotate-180" : "",
                              )}
                            />
                          </button>
                        </div>
                      ) : (
                        /* Non-cost-entry variant row */
                        <div className="grid items-end gap-3 p-4 sm:grid-cols-[1fr_140px_80px_80px_40px]">
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
                            <Label className="text-xs">Qty</Label>
                            <Input
                              min={0}
                              type="number"
                              value={v.stockQuantity || ""}
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
                          <div className="space-y-1">
                            <Label className="text-xs">Min</Label>
                            <Input
                              min={0}
                              type="number"
                              value={v.minimumStock}
                              onChange={(e) =>
                                updateVariantField(
                                  v.color,
                                  v.size,
                                  "minimumStock",
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
                      )}

                      {/* Per-variant cost details (expand) */}
                      {canEnterCost && v.showCostDetails && (
                        <div className="border-t border-dashed border-musiva-border px-4 pb-4 pt-3">
                          <div className="space-y-3">
                            {hasCostForVariant && (
                              <div className="rounded bg-musiva-ivory px-3 py-2 text-sm tabular-nums">
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-musiva-gold">
                                  Cost breakdown
                                </p>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between gap-4 text-muted-foreground">
                                    <span>Buying price</span>
                                    <span className="font-medium text-foreground">
                                      {formatInr(v.buyingPriceInr)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-muted-foreground">
                                    <span>Converted cost</span>
                                    <span className="font-medium text-foreground">
                                      {formatBhd(vConverted)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-muted-foreground">
                                    <span>Import cost</span>
                                    <span className="font-medium text-foreground">
                                      {formatBhd(openingCost.extraImportCostBhd)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 border-t border-musiva-border pt-1">
                                    <span className="font-semibold text-musiva-plum">
                                      Landed cost
                                    </span>
                                    <span className="font-semibold text-musiva-plum">
                                      {formatBhd(vLanded)}
                                    </span>
                                  </div>
                                  {profit !== null && margin !== null && (
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span className="text-xs text-muted-foreground">
                                        Est. profit:
                                      </span>
                                      <ProfitBadge margin={margin} profit={profit} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Per-variant buying price override */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Buying price for this option (INR)
                                </Label>
                                <Input
                                  min={0}
                                  placeholder="Leave blank to use bulk value"
                                  step="0.01"
                                  type="number"
                                  value={v.buyingPriceInr || ""}
                                  onChange={(e) =>
                                    updateVariantBuyingPrice(
                                      v.color,
                                      v.size,
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Landed cost override (BHD — optional)
                                </Label>
                                <Input
                                  min={0}
                                  placeholder={vLanded > 0 ? String(vLanded) : "0.000"}
                                  step="0.001"
                                  type="number"
                                  value={v.landedCostOverrideBhd ?? ""}
                                  onChange={(e) =>
                                    updateVariantCostOverride(
                                      v.color,
                                      v.size,
                                      e.target.value ? Number(e.target.value) : null,
                                    )
                                  }
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Only set this if you want to override the calculated cost.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Summary row ───────────────────────────────────────── */}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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

        <div className="ml-auto flex gap-3">
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
