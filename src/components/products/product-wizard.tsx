"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ImageOff,
  Info,
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
import { CategorySelect } from "@/components/products/category-select";
import {
  PriceConfirmationDialog,
  type PriceConfirmationRow,
} from "@/components/products/price-confirmation-dialog";
import { generateProductSku } from "@/lib/utils/sku";
import { generateVariants, type GeneratedVariant } from "@/lib/utils/variant-generator";
import { createProductAction } from "@/app/admin/products/actions";
import { uploadProductImageAction } from "@/app/admin/products/image-actions";
import { formatBhd } from "@/lib/formatters/currency";
import {
  convertToBhd,
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
  /** Current INR → BHD rate from Settings → Exchange Rates (multiply direction), or null
   *  if no manager has set one yet. Auto-fills the wizard — staff never type a rate here. */
  currentExchangeRate: number | null;
  currentExchangeRateDate: string | null;
  currentExchangeRateSource: string | null;
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
  /** Sizes typed by staff while "Use specific sizes" is active. Kept separate from the
   *  effective sizes used for generation so toggling Free Size on and back off never
   *  loses what staff already typed — see resolveStep2Sizes. */
  specificSizes: string[];
  isFreeSize: boolean;
};

/** The exact label stored and displayed everywhere (variant.size, order snapshots, the
 *  public site) when a product has no specific sizes — never abbreviated to "FREE". */
export const FREE_SIZE_LABEL = "Free Size";

/** The sizes actually used for variant generation: a single "Free Size" entry when the
 *  toggle is on, otherwise whatever staff typed into the specific-sizes chip input. */
export function resolveStep2Sizes(isFreeSize: boolean, specificSizes: string[]): string[] {
  return isFreeSize ? [FREE_SIZE_LABEL] : specificSizes;
}

/** Case-insensitive, trim-insensitive duplicate check for the colors/sizes chip inputs —
 *  "Black" and "black", "XL" and "xl" are the same entry. */
export function isDuplicateChip(existing: string[], candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  return existing.some((chip) => chip.trim().toLowerCase() === normalized);
}

/** Extension of GeneratedVariant that carries per-variant cost/profit inputs. Converted
 *  buying/import cost BHD is always calculated (converted from INR) — there is no manual
 *  override of those. importCostInr is OPTIONAL (cargo/customs/packing/transfer/delivery
 *  from India to Bahrain, per piece) — defaults to 0, staff are never required to enter it.
 *  profitInput is the desired profit (BHD amount or margin %, per the wizard-level
 *  profitType) used to suggest regularSellingPriceBhd — staff can still override the
 *  resulting price directly in the confirmation popup before creating the product. */
type WizardVariant = GeneratedVariant & {
  buyingPriceInr: number;
  importCostInr: number;
  profitInput: number;
};

type Step3Data = {
  variants: WizardVariant[];
};

// ── derived cost calculations ─────────────────────────────────────────────────
// Exported (not just internal helpers) so the cost/profit calculator introduced here can be
// unit-tested without a component-rendering library — see product-wizard-price-suggestion.test.ts.

/** Buying price converted to BHD. Returns 0 without a valid (>0) exchange rate — buying
 *  price can never be converted without one, per the buying-cost workflow's rules. */
export function deriveVariantConvertedCost(
  buyingPriceInr: number,
  exchangeRateToBhd: number | null,
): number {
  if (!buyingPriceInr || !exchangeRateToBhd || exchangeRateToBhd <= 0) return 0;
  return roundBhd(convertToBhd(buyingPriceInr, exchangeRateToBhd));
}

/** Import cost converted to BHD — staff enter it in INR (the India-side amount they actually
 *  know), the same conversion rule as buying price. Only the converted BHD figure is ever
 *  saved (product_variants.latest_additional_landed_cost_bhd) — the raw INR figure is a
 *  Step 3 input only, not persisted separately. */
export function deriveImportCostBhd(
  importCostInr: number,
  exchangeRateToBhd: number | null,
): number {
  if (!importCostInr || !exchangeRateToBhd || exchangeRateToBhd <= 0) return 0;
  return roundBhd(convertToBhd(importCostInr, exchangeRateToBhd));
}

/** Final cost in Bahrain = converted buying cost + converted import cost (both entered in
 *  INR). Returns 0 when there is no valid converted buying cost yet — import cost can never
 *  make an otherwise-missing base cost "valid" on its own. */
export function deriveVariantFinalCost(
  buyingPriceInr: number,
  exchangeRateToBhd: number | null,
  importCostInr: number,
): number {
  const converted = deriveVariantConvertedCost(buyingPriceInr, exchangeRateToBhd);
  if (converted <= 0) return 0;
  return roundBhd(converted + deriveImportCostBhd(importCostInr, exchangeRateToBhd));
}

/** How staff express their desired profit: a flat BHD amount added on top of cost, or a
 *  target margin percentage of the selling price. Default is "amount" — simpler to reason
 *  about for staff unfamiliar with margin math. */
export type ProfitType = "amount" | "margin";

/** A margin percentage must be 0–99.999...% — 100% or more implies an infinite or negative
 *  selling price (cost / (1 - 1) or worse), which is never a sane input. Returns a
 *  staff-facing error message, or null when the value is valid. */
export function validateMarginPercent(marginPercent: number): string | null {
  if (marginPercent < 0) return "Margin percentage cannot be negative.";
  if (marginPercent >= 100) return "Margin percentage must be less than 100%.";
  return null;
}

/** Suggested selling price from final cost + desired profit, per the chosen profit type:
 *  - "amount": finalCost + desired profit (BHD)
 *  - "margin": finalCost / (1 - margin / 100)
 *  Returns 0 when there is no valid final cost yet (nothing to base a suggestion on), or
 *  when the margin input is invalid — callers show the actual validation message via
 *  validateMarginPercent, this never throws or returns a negative/infinite price. */
export function deriveSuggestedSellingPrice(
  finalCostBhd: number,
  profitType: ProfitType,
  profitInput: number,
): number {
  if (finalCostBhd <= 0) return 0;

  if (profitType === "amount") {
    return roundBhd(finalCostBhd + Math.max(0, profitInput || 0));
  }

  if (validateMarginPercent(profitInput) !== null) return 0;
  return roundBhd(finalCostBhd / (1 - profitInput / 100));
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
  label?: string;
  hint?: string;
  chips: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const trimmed = input.trim();
    if (trimmed && !isDuplicateChip(chips, trimmed)) {
      onAdd(trimmed);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
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

export function ProductWizard({
  categories,
  userRole,
  currentExchangeRate,
  currentExchangeRateDate,
  currentExchangeRateSource,
}: ProductWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Role-based cost permissions.
  const canEnterCost = canEnterBuyingCost(userRole);
  const canViewProfit = canViewCostData(userRole);
  const hasExchangeRate = currentExchangeRate !== null && currentExchangeRate > 0;
  // Fallback: when no default rate is set in Settings, staff can enter the purchase rate
  // for this product only (not saved as the new default). Never used when a default exists.
  const [fallbackRate, setFallbackRate] = useState<number>(0);
  const effectiveExchangeRate = hasExchangeRate
    ? currentExchangeRate
    : fallbackRate > 0
      ? fallbackRate
      : null;
  const hasEffectiveRate = effectiveExchangeRate !== null && effectiveExchangeRate > 0;

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
  const [step2, setStep2] = useState<Step2Data>({
    colors: [],
    specificSizes: [],
    isFreeSize: false,
  });
  const [step3, setStep3] = useState<Step3Data>({ variants: [] });

  // bulk setter inputs
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkBuyingPriceInr, setBulkBuyingPriceInr] = useState<number>(0);
  const [bulkImportCostInr, setBulkImportCostInr] = useState<number>(0);
  const [bulkProfitInput, setBulkProfitInput] = useState<number>(0);
  const [profitType, setProfitType] = useState<ProfitType>("amount");
  const [bulkMinStock, setBulkMinStock] = useState<number>(1);
  const [bulkStartingQty, setBulkStartingQty] = useState<number>(0);

  // Confirmation popup shown before creating the product — only for staff who can view
  // profit/margin (canViewProfit below). Staff who can only enter buying cost, but not view
  // profit, keep the simpler direct-create flow they had before (they type selling price
  // manually in Step 3 itself, same as always).
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false);

  // ── derived values ───────────────────────────────────────────────────────────

  const bulkConvertedCost = deriveVariantConvertedCost(bulkBuyingPriceInr, effectiveExchangeRate);
  const bulkFinalCost = deriveVariantFinalCost(
    bulkBuyingPriceInr,
    effectiveExchangeRate,
    bulkImportCostInr,
  );
  const bulkImportCostBhd = deriveImportCostBhd(bulkImportCostInr, effectiveExchangeRate);
  const bulkMarginError = profitType === "margin" ? validateMarginPercent(bulkProfitInput) : null;
  const bulkSuggestedPrice =
    bulkMarginError === null
      ? deriveSuggestedSellingPrice(bulkFinalCost, profitType, bulkProfitInput)
      : 0;
  const showBulkPreview = canEnterCost && bulkConvertedCost > 0;

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
    (size: string) =>
      setStep2((prev) => ({ ...prev, specificSizes: [...prev.specificSizes, size] })),
    [],
  );
  const removeSize = useCallback(
    (size: string) =>
      setStep2((prev) => ({
        ...prev,
        specificSizes: prev.specificSizes.filter((s) => s !== size),
      })),
    [],
  );
  const setFreeSize = useCallback(
    (isFreeSize: boolean) => setStep2((prev) => ({ ...prev, isFreeSize })),
    [],
  );

  const step2Sizes = resolveStep2Sizes(step2.isFreeSize, step2.specificSizes);

  function goToStep3() {
    if (step2.colors.length === 0) {
      setFormError("Add at least one color.");
      return;
    }
    if (step2Sizes.length === 0) {
      setFormError("Add at least one size.");
      return;
    }
    setFormError(null);
    const productSku = step1.sku.trim() || generateProductSku(step1.name);
    const generated = generateVariants(productSku, step2.colors, step2Sizes, {
      regularSellingPriceBhd: 0,
      stockQuantity: 0,
      minimumStock: bulkMinStock,
    });
    setStep3({
      variants: generated.map((v) => ({
        ...v,
        buyingPriceInr: 0,
        importCostInr: 0,
        profitInput: 0,
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

  function updateVariantImportCost(color: string, size: string, value: number) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size ? { ...v, importCostInr: value } : v,
      ),
    }));
  }

  function updateVariantProfitInput(color: string, size: string, value: number) {
    setStep3((prev) => ({
      variants: prev.variants.map((v) =>
        v.color === color && v.size === size ? { ...v, profitInput: value } : v,
      ),
    }));
  }

  /** Only non-zero bulk fields are applied — a field left at 0 is indistinguishable from
   *  "untouched" in a plain number input, so applying it would silently overwrite whatever
   *  staff already customized per-option. This matches the existing convention for every
   *  other bulk field here; per-option rows remain the way to set a genuine 0 on a single
   *  option. Selling price becomes a suggestion (from cost + desired profit) for staff who
   *  can view profit — for everyone else it's still the plain bulk price, as before. */
  function applyBulkAll() {
    setStep3((prev) => ({
      variants: prev.variants.map((v) => {
        const nextBuyingPriceInr = bulkBuyingPriceInr > 0 ? bulkBuyingPriceInr : v.buyingPriceInr;
        const nextImportCostInr = bulkImportCostInr > 0 ? bulkImportCostInr : v.importCostInr;
        const nextProfitInput = bulkProfitInput > 0 ? bulkProfitInput : v.profitInput;

        const next: WizardVariant = {
          ...v,
          buyingPriceInr: nextBuyingPriceInr,
          importCostInr: nextImportCostInr,
          profitInput: nextProfitInput,
          ...(bulkMinStock > 0 ? { minimumStock: bulkMinStock } : {}),
          ...(bulkStartingQty > 0 ? { stockQuantity: bulkStartingQty } : {}),
        };

        if (canViewProfit) {
          const finalCost = deriveVariantFinalCost(
            nextBuyingPriceInr,
            effectiveExchangeRate,
            nextImportCostInr,
          );
          const marginError =
            profitType === "margin" ? validateMarginPercent(nextProfitInput) : null;
          const suggested =
            marginError === null
              ? deriveSuggestedSellingPrice(finalCost, profitType, nextProfitInput)
              : 0;
          if (suggested > 0) {
            next.regularSellingPriceBhd = suggested;
            next.sellingPrice = suggested;
          }
        } else if (bulkPrice > 0) {
          next.regularSellingPriceBhd = bulkPrice;
          next.sellingPrice = bulkPrice;
        }

        return next;
      }),
    }));
  }

  // ── submit ───────────────────────────────────────────────────────────────────

  /** Accepts an explicit variant list so the price-confirmation popup can pass its own
   *  (possibly staff-edited) prices straight through — reading step3.variants here instead
   *  would race the setStep3() call the popup makes on confirm, since React state updates
   *  aren't applied synchronously. */
  function handleSubmit(variantsOverride?: WizardVariant[]) {
    const variantsToSubmit = variantsOverride ?? step3.variants;

    if (variantsToSubmit.length === 0) {
      setFormError("At least one size/color option is required.");
      return;
    }

    // Validate cost fields when any variant has a buying price.
    const hasAnyCost = canEnterCost && variantsToSubmit.some((v) => v.buyingPriceInr > 0);
    if (hasAnyCost && !hasEffectiveRate) {
      setFormError("Enter the INR to BHD exchange rate before saving buying cost.");
      return;
    }

    setFormError(null);

    // Include opening cost only when at least one variant has a buying price and a rate
    // is available (either the default from Settings, or the per-product fallback rate).
    const sendOpeningCost =
      hasAnyCost && hasEffectiveRate
        ? {
            buyingCurrency: "INR",
            buyingPricePerPiece: 0,
            exchangeRateToBhd: effectiveExchangeRate!,
            exchangeRateDate: hasExchangeRate
              ? (currentExchangeRateDate ?? new Date().toISOString().slice(0, 10))
              : new Date().toISOString().slice(0, 10),
            exchangeRateSource: (hasExchangeRate ? (currentExchangeRateSource ?? "manual") : "manual") as
              | "manual"
              | "bank"
              | "other",
          }
        : null;

    startTransition(async () => {
      const result = await createProductAction({
        name: step1.name.trim(),
        // Sent as-typed (may be blank) — the server auto-generates a code from the
        // product name when blank, and never overwrites a code staff typed themselves.
        sku: step1.sku.trim(),
        categoryId: step1.categoryId || null,
        collection: step1.collection.trim() || null,
        description: step1.description.trim() || null,
        material: step1.material.trim() || null,
        careInstructions: step1.careInstructions.trim() || null,
        status: "active",
        openingCost: sendOpeningCost,
        // New products are never published from the wizard — staff opt in
        // from Edit → Ecommerce / Website once the product is reviewed.
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
        variants: variantsToSubmit.map((v) => ({
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
          // Staff enter import cost in INR (the amount they actually know) — only the
          // converted BHD figure is ever saved, matching the existing
          // latest_additional_landed_cost_bhd column's contract.
          importCostBhd: deriveImportCostBhd(v.importCostInr, effectiveExchangeRate),
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

  function buildConfirmationRows(): PriceConfirmationRow[] {
    return step3.variants.map((v) => {
      const finalCostBhd = deriveVariantFinalCost(
        v.buyingPriceInr,
        effectiveExchangeRate,
        v.importCostInr,
      );
      const marginError = profitType === "margin" ? validateMarginPercent(v.profitInput) : null;
      const suggestedPriceBhd =
        marginError === null
          ? deriveSuggestedSellingPrice(finalCostBhd, profitType, v.profitInput)
          : 0;
      return {
        key: `${v.color}__${v.size}`,
        optionLabel: `${v.color} / ${v.size}`,
        buyingPriceInr: v.buyingPriceInr,
        importCostInr: v.importCostInr,
        finalCostBhd,
        suggestedPriceBhd,
      };
    });
  }

  /** Staff who can view profit/margin get a review popup before the product is actually
   *  created (see section 8 of the spec) — everyone else keeps the direct-create flow they
   *  already had, since they type selling price manually and there's no suggestion to
   *  review. */
  function handleCreateClick() {
    if (step3.variants.length === 0) {
      setFormError("At least one size/color option is required.");
      return;
    }

    if (!canViewProfit) {
      handleSubmit();
      return;
    }

    if (profitType === "margin") {
      const invalid = step3.variants.find((v) => {
        const finalCost = deriveVariantFinalCost(
          v.buyingPriceInr,
          effectiveExchangeRate,
          v.importCostInr,
        );
        return finalCost > 0 && validateMarginPercent(v.profitInput) !== null;
      });
      if (invalid) {
        setFormError(validateMarginPercent(invalid.profitInput));
        return;
      }
    }

    setFormError(null);
    setShowPriceConfirmation(true);
  }

  /** Merge the popup's (possibly staff-edited) prices back into step3 for display, then
   *  submit using that exact same list — handleSubmit takes an explicit override so this
   *  never races the setStep3() call above (state updates aren't synchronous). */
  function handleConfirmFromPopup(prices: Record<string, number>) {
    const finalVariants = step3.variants.map((v) => {
      const price = prices[`${v.color}__${v.size}`] ?? v.regularSellingPriceBhd;
      return { ...v, regularSellingPriceBhd: price, sellingPrice: price };
    });
    setStep3({ variants: finalVariants });
    setShowPriceConfirmation(false);
    handleSubmit(finalVariants);
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
                <CategorySelect
                  id="category"
                  categories={categories}
                  value={step1.categoryId}
                  onChange={(categoryId) => update1("categoryId", categoryId)}
                />
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
                  <Label htmlFor="sku">Product SKU / code (optional)</Label>
                  <Input
                    id="sku"
                    placeholder={step1.name ? generateProductSku(step1.name) : "e.g. 05T"}
                    value={step1.sku}
                    onChange={(e) => update1("sku", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Type your own product code, or leave blank to auto-generate one from the
                    product name. Each variant&apos;s option code is generated from this code plus
                    its color and size.
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
              hint='Type a color and press Enter or "+" to add it. Mixed colors like "Black &amp; White" or "Rani Pink" are fine.'
              chips={step2.colors}
              label="Colors"
              placeholder="e.g. Black, Black & White, Rani Pink"
              onAdd={addColor}
              onRemove={removeColor}
            />

            <div className="space-y-2">
              <Label>Sizes</Label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-musiva-plum">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-musiva-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  checked={step2.isFreeSize}
                  onChange={(e) => setFreeSize(e.target.checked)}
                />
                This product is Free Size
              </label>

              {step2.isFreeSize ? (
                <div className="space-y-1.5 pt-1">
                  <span className="inline-flex w-fit items-center rounded-full border border-musiva-border bg-musiva-ivory px-3 py-1 text-sm font-medium text-musiva-plum">
                    {FREE_SIZE_LABEL}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Free Size will be used for all color options.
                  </p>
                </div>
              ) : (
                <ChipInput
                  hint='Type a size and press Enter or "+" to add it.'
                  chips={step2.specificSizes}
                  placeholder="e.g. XS, S, M, L, XL"
                  onAdd={addSize}
                  onRemove={removeSize}
                />
              )}
            </div>

            {step2.colors.length > 0 && step2Sizes.length > 0 && (
              <div className="rounded-md bg-musiva-ivory p-4">
                <p className="text-sm font-medium text-musiva-plum">
                  Options to be created — {step2.colors.length * step2Sizes.length} option
                  {step2.colors.length * step2Sizes.length !== 1 ? "s" : ""}:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step2.colors.flatMap((color) =>
                    step2Sizes.map((size) => (
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
            {canEnterCost && !hasExchangeRate && (
              <div className="space-y-3 rounded-md border border-musiva-warning/30 bg-musiva-warning/10 px-4 py-3 text-sm text-musiva-warning-foreground">
                <p>
                  No INR to BHD rate is set. Ask a manager to add a default rate, or enter the
                  purchase rate before saving buying cost.
                </p>
                <div className="max-w-xs space-y-1">
                  <Label className="text-xs" htmlFor="fallback-rate">
                    Purchase rate for this product (1 INR = ? BHD)
                  </Label>
                  <Input
                    id="fallback-rate"
                    min={0}
                    placeholder="0.004520"
                    step="0.000001"
                    type="number"
                    value={fallbackRate || ""}
                    onChange={(e) => setFallbackRate(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            {/* ── Bulk setters (cost-entry users) ──────────────────── */}
            {canEnterCost ? (
              <div className="space-y-4 rounded-md bg-musiva-ivory p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-buy-inr">Buying price in India for all options (INR)</Label>
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
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="bulk-import-inr">Import cost from India per piece (INR)</Label>
                      <span
                        aria-label="What is import cost?"
                        className="text-muted-foreground/70"
                        title="Extra cost per piece for cargo, customs, packing, transfer, or delivery from India to Bahrain."
                      >
                        <Info aria-hidden className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <Input
                      id="bulk-import-inr"
                      min={0}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={bulkImportCostInr || ""}
                      onChange={(e) => setBulkImportCostInr(Number(e.target.value) || 0)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Optional. Leave 0 if not needed.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Exchange rate</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {hasEffectiveRate
                        ? `1 INR = BHD ${Number(effectiveExchangeRate).toFixed(6)}`
                        : "Not set — see Settings"}
                    </div>
                  </div>

                  {canViewProfit ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="bulk-profit">
                          Desired profit {profitType === "amount" ? "(BHD)" : "(%)"}
                        </Label>
                        <Input
                          id="bulk-profit"
                          min={0}
                          placeholder={profitType === "amount" ? "0.000" : "0"}
                          step={profitType === "amount" ? "0.001" : "0.1"}
                          type="number"
                          value={bulkProfitInput || ""}
                          onChange={(e) => setBulkProfitInput(Number(e.target.value) || 0)}
                        />
                        {bulkMarginError && (
                          <p className="text-xs text-destructive">{bulkMarginError}</p>
                        )}
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
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-price">
                        Selling price / Final customer price for all options (BHD)
                      </Label>
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
                  )}

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
                  Buying cost preview (bulk)
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
                      1 INR = BHD {Number(effectiveExchangeRate).toFixed(6)}
                    </span>
                  </div>
                  {bulkImportCostBhd > 0 ? (
                    <>
                      <div className="col-span-full mt-1 flex justify-between gap-4 border-t border-musiva-border pt-2">
                        <span className="font-medium text-foreground">Converted buying cost (BHD)</span>
                        <span className="font-medium text-foreground">
                          {formatBhd(bulkConvertedCost)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-muted-foreground">
                        <span>Import cost (BHD)</span>
                        <span className="font-medium text-foreground">
                          {formatBhd(bulkImportCostBhd)}
                        </span>
                      </div>
                      <div className="col-span-full flex justify-between gap-4 border-t border-musiva-border pt-2">
                        <span className="font-semibold text-musiva-plum">Final cost in Bahrain (BHD)</span>
                        <span className="font-semibold text-musiva-plum">
                          {formatBhd(bulkFinalCost)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-full mt-1 flex justify-between gap-4 border-t border-musiva-border pt-2">
                      <span className="font-semibold text-musiva-plum">Converted buying cost (BHD)</span>
                      <span className="font-semibold text-musiva-plum">
                        {formatBhd(bulkConvertedCost)}
                      </span>
                    </div>
                  )}
                  {canViewProfit ? (
                    <>
                      {bulkSuggestedPrice > 0 && (
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Suggested selling price (BHD)</span>
                          <span className="font-medium text-foreground">
                            {formatBhd(bulkSuggestedPrice)}
                          </span>
                        </div>
                      )}
                      {bulkSuggestedPrice > 0 && bulkFinalCost > 0 && (
                        <div className="col-span-full flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">Est. profit:</span>
                          <ProfitBadge
                            margin={calcEstimatedMargin(bulkSuggestedPrice, bulkFinalCost)}
                            profit={calcEstimatedProfit(bulkSuggestedPrice, bulkFinalCost)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    bulkPrice > 0 && (
                      <div className="flex justify-between gap-4 text-muted-foreground">
                        <span>Selling price (BHD)</span>
                        <span className="font-medium text-foreground">{formatBhd(bulkPrice)}</span>
                      </div>
                    )
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
                  const vFinal = deriveVariantFinalCost(
                    v.buyingPriceInr,
                    effectiveExchangeRate,
                    v.importCostInr,
                  );
                  const vMarginError =
                    profitType === "margin" ? validateMarginPercent(v.profitInput) : null;
                  const vSuggested =
                    vMarginError === null
                      ? deriveSuggestedSellingPrice(vFinal, profitType, v.profitInput)
                      : 0;
                  const profit =
                    canViewProfit && vFinal > 0 && v.regularSellingPriceBhd > 0
                      ? calcEstimatedProfit(v.regularSellingPriceBhd, vFinal)
                      : null;
                  const margin =
                    canViewProfit && vFinal > 0 && v.regularSellingPriceBhd > 0
                      ? calcEstimatedMargin(v.regularSellingPriceBhd, vFinal)
                      : null;
                  const belowCost =
                    vFinal > 0 &&
                    v.regularSellingPriceBhd > 0 &&
                    v.regularSellingPriceBhd < vFinal;

                  return (
                    <div
                      key={`${v.color}-${v.size}`}
                      className="rounded-md border border-musiva-border bg-white"
                    >
                      {canEnterCost && canViewProfit ? (
                        /* Cost + profit calculator row */
                        <div className="grid items-end gap-2 p-3 sm:grid-cols-[1fr_90px_90px_90px_64px_64px_32px]">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-musiva-plum">
                              {v.color} / {v.size}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {v.variantSku}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Buy India (INR)</Label>
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
                          <div className="space-y-1">
                            <Label className="text-[11px]">Import India (INR)</Label>
                            <Input
                              min={0}
                              step="0.01"
                              type="number"
                              value={v.importCostInr || ""}
                              onChange={(e) =>
                                updateVariantImportCost(
                                  v.color,
                                  v.size,
                                  Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              {profitType === "amount" ? "Profit (BHD)" : "Margin (%)"}
                            </Label>
                            <Input
                              min={0}
                              step={profitType === "amount" ? "0.001" : "0.1"}
                              type="number"
                              value={v.profitInput || ""}
                              onChange={(e) =>
                                updateVariantProfitInput(
                                  v.color,
                                  v.size,
                                  Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
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
                          <button
                            aria-label={`Remove ${v.color} / ${v.size}`}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-musiva-border text-muted-foreground hover:border-destructive hover:text-destructive"
                            type="button"
                            onClick={() => removeVariant(v.color, v.size)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </button>
                        </div>
                      ) : canEnterCost ? (
                        /* Cost-entry row without profit visibility — selling price stays a
                           manually-typed field (no suggestion to show without profit data). */
                        <div className="grid items-end gap-2 p-3 sm:grid-cols-[1fr_90px_90px_90px_64px_64px_32px]">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-musiva-plum">
                              {v.color} / {v.size}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {v.variantSku}
                            </p>
                          </div>
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
                          <div className="space-y-1">
                            <Label className="text-[11px]">Buy India (INR)</Label>
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
                          <div className="space-y-1">
                            <Label className="text-[11px]">Import India (INR)</Label>
                            <Input
                              min={0}
                              step="0.01"
                              type="number"
                              value={v.importCostInr || ""}
                              onChange={(e) =>
                                updateVariantImportCost(
                                  v.color,
                                  v.size,
                                  Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
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
                          <button
                            aria-label={`Remove ${v.color} / ${v.size}`}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-musiva-border text-muted-foreground hover:border-destructive hover:text-destructive"
                            type="button"
                            onClick={() => removeVariant(v.color, v.size)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
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

                      {/* Compact read-only cost/profit recap — keeps the input grid above from
                          getting overloaded with extra read-only columns (see spec: "if space
                          is tight, show cost summary below each row in a compact line"). */}
                      {canEnterCost && (vFinal > 0 || v.importCostInr > 0) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-musiva-border bg-musiva-ivory/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                          <span>
                            Cost Bahrain:{" "}
                            <span className="font-medium text-foreground">
                              {vFinal > 0 ? formatBhd(vFinal) : "Not recorded"}
                            </span>
                          </span>
                          {canViewProfit && vSuggested > 0 && (
                            <span>
                              Suggested price:{" "}
                              <span className="font-medium text-foreground">
                                {formatBhd(vSuggested)}
                              </span>
                            </span>
                          )}
                          {profit !== null && margin !== null && (
                            <span className="flex items-center gap-1">
                              Profit: <ProfitBadge margin={margin} profit={profit} />
                            </span>
                          )}
                          {vMarginError && (
                            <span className="text-destructive">{vMarginError}</span>
                          )}
                        </div>
                      )}

                      {belowCost && (
                        <p className="border-t border-dashed border-musiva-warning/30 bg-musiva-warning/10 px-3 py-1.5 text-xs text-musiva-warning-foreground">
                          Selling price is below final cost.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Summary ───────────────────────────────────────────── */}
            {step3.variants.length > 0 && (
              <div className="space-y-2 rounded-md bg-musiva-ivory p-4 text-sm">
                <p className="font-medium text-musiva-plum">
                  {step3.variants.length} option{step3.variants.length !== 1 ? "s" : ""}
                  {" · "}
                  {step3.variants.reduce((s, v) => s + v.stockQuantity, 0)} units starting stock
                </p>

                {canEnterCost ? (
                  (() => {
                    const totalBuyingInr = step3.variants.reduce(
                      (s, v) => s + v.buyingPriceInr * v.stockQuantity,
                      0,
                    );
                    const totalFinalCostBhd = step3.variants.reduce(
                      (s, v) =>
                        s +
                        deriveVariantFinalCost(
                          v.buyingPriceInr,
                          effectiveExchangeRate,
                          v.importCostInr,
                        ) *
                          v.stockQuantity,
                      0,
                    );
                    const totalSellingBhd = step3.variants.reduce(
                      (s, v) => s + v.regularSellingPriceBhd * v.stockQuantity,
                      0,
                    );
                    const estProfit = totalSellingBhd - totalFinalCostBhd;
                    const estMargin = totalSellingBhd > 0 ? (estProfit / totalSellingBhd) * 100 : null;

                    return (
                      <div className="grid gap-1 border-t border-musiva-border pt-2 tabular-nums sm:grid-cols-2">
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Total buying value (INR)</span>
                          <span className="font-medium text-foreground">
                            {formatInr(totalBuyingInr)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Total final cost (BHD)</span>
                          <span className="font-medium text-foreground">
                            {formatBhd(totalFinalCostBhd)}
                          </span>
                        </div>
                        {minPrice !== null && (
                          <div className="flex justify-between gap-4 text-muted-foreground">
                            <span>From selling price</span>
                            <span className="font-medium text-foreground">
                              {formatBhd(minPrice)}
                            </span>
                          </div>
                        )}
                        {canViewProfit && (
                          <>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                              <span>Estimated selling value</span>
                              <span className="font-medium text-foreground">
                                {formatBhd(totalSellingBhd)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                              <span>Estimated gross profit</span>
                              <span className="font-medium text-foreground">
                                {formatBhd(estProfit)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                              <span>Estimated margin</span>
                              <span className="font-medium text-foreground">
                                {estMargin !== null ? `${estMargin.toFixed(2)}%` : "—"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  minPrice !== null && (
                    <p className="text-muted-foreground">From {formatBhd(minPrice)}</p>
                  )
                )}
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
              onClick={handleCreateClick}
            >
              {isPending
                ? "Creating…"
                : canViewProfit
                  ? "Review & create"
                  : "Create product"}
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

      {canViewProfit && (
        <PriceConfirmationDialog
          open={showPriceConfirmation}
          rows={buildConfirmationRows()}
          isSubmitting={isPending}
          onBack={() => setShowPriceConfirmation(false)}
          onConfirm={handleConfirmFromPopup}
        />
      )}
    </div>
  );
}
