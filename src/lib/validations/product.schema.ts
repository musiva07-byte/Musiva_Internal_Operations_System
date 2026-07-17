import { z } from "zod";
import { PRODUCT_STATUSES, STOCK_MOVEMENT_TYPES } from "@/lib/constants";

// ── Opening stock buying cost (INR → BHD) ─────────────────────────────────────

/**
 * Captured once per product when creating initial stock from India.
 * Future stock purchases use Purchases → New Purchase instead.
 *
 * Exchange rate convention in this schema:
 *   exchangeRateToBhd = 1 supplier-currency unit in BHD (multiply direction).
 *   Example: 1 INR = 0.004520 BHD → exchangeRateToBhd = 0.004520
 *   converted_cost_bhd = buyingPricePerPiece × exchangeRateToBhd
 *
 * No import/shipping/customs cost is collected here — this workflow only converts
 * currency. Buying price BHD is always the converted cost, nothing is added to it.
 */
export const openingCostSchema = z.object({
  buyingCurrency: z.string().min(1).default("INR"),
  /** Shared buying price per piece (legacy — prefer per-variant buyingPriceInr). */
  buyingPricePerPiece: z.coerce
    .number()
    .min(0, "Buying price must be 0 or greater.")
    .optional()
    .default(0),
  /** 1 supplier-currency unit expressed in BHD. Must be > 0. */
  exchangeRateToBhd: z.coerce
    .number()
    .positive("Exchange rate must be greater than 0."),
  exchangeRateDate: z.string().min(1, "Exchange rate date is required."),
  exchangeRateSource: z
    .enum(["manual", "bank", "other"])
    .default("manual"),
});

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalSlug = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens only.")
    .nullable()
    .optional(),
);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().min(0).multipleOf(0.001).nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);
const stockQuantity = z.coerce.number().int().min(0);

export const productVariantSchema = z
  .object({
    id: z.string().uuid().optional(),
    variantSku: z.string().trim().min(1, "Variant SKU is required."),
    barcode: optionalText,
    color: z.string().trim().min(1, "Color is required."),
    size: z.string().trim().min(1, "Size is required."),
    /** @deprecated Use regularSellingPriceBhd */
    costPrice: money,
    /** @deprecated Use regularSellingPriceBhd */
    sellingPrice: money,
    /** @deprecated Use discountPriceBhd */
    discountPrice: optionalMoney,
    // Phase 11 pricing fields
    regularSellingPriceBhd: money,
    discountPriceBhd: optionalMoney,
    discountStartAt: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().datetime({ offset: true }).nullable().optional(),
    ),
    discountEndAt: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().datetime({ offset: true }).nullable().optional(),
    ),
    stockQuantity,
    minimumStock: stockQuantity,
    status: z.enum([PRODUCT_STATUSES.active, PRODUCT_STATUSES.inactive, PRODUCT_STATUSES.archived, PRODUCT_STATUSES.draft]),
    /** Buying price in INR for this specific variant (per-variant cost entry). */
    buyingPriceInr: z.coerce.number().min(0).optional().default(0),
  })
  .refine(
    (v) =>
      v.discountPriceBhd === null ||
      v.discountPriceBhd === undefined ||
      v.discountPriceBhd < v.regularSellingPriceBhd,
    {
      message: "Discount price must be lower than the regular selling price.",
      path: ["discountPriceBhd"],
    },
  )
  .refine(
    (v) =>
      !(v.discountEndAt && v.discountStartAt && v.discountEndAt <= v.discountStartAt),
    {
      message: "Discount end date must be after the start date.",
      path: ["discountEndAt"],
    },
  );

export const productImageSchema = z.object({
  id: z.string().uuid().optional(),
  variantId: optionalUuid,
  url: z.string().url("Image URL must be a valid URL."),
  path: z.string().trim().min(1, "Storage path is required."),
  isPrimary: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Product name is required."),
  sku: z.string().trim().min(1, "Product SKU is required."),
  categoryId: optionalUuid,
  collection: optionalText,
  description: optionalText,
  material: optionalText,
  careInstructions: optionalText,
  status: z.enum([PRODUCT_STATUSES.active, PRODUCT_STATUSES.inactive, PRODUCT_STATUSES.archived, PRODUCT_STATUSES.draft]),
  variants: z.array(productVariantSchema).min(1, "Add at least one color and size variant."),
  images: z.array(productImageSchema).default([]),
  /** Initial buying cost from India — used only during product creation for opening stock. */
  openingCost: openingCostSchema.nullable().optional(),
  // ── Ecommerce / Website (public website publishing) ─────────────────────────
  /** Auto-generated from the name when left blank. Never auto-changed after it's set. */
  slug: optionalSlug,
  websiteVisible: z.coerce.boolean().default(false),
  onlineStatus: z.enum(["draft", "published", "hidden"]).default("hidden"),
  websiteTitle: optionalText,
  websiteDescription: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  featured: z.coerce.boolean().default(false),
  newArrival: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const stockEntrySchema = z.object({
  productVariantId: z.string().uuid("Select a product variant."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  movementType: z.enum([
    STOCK_MOVEMENT_TYPES.openingStock,
    STOCK_MOVEMENT_TYPES.purchaseStock,
    STOCK_MOVEMENT_TYPES.returnAdded,
    STOCK_MOVEMENT_TYPES.cancelledOrderRestore,
  ]),
  referenceType: optionalText,
  referenceId: optionalUuid,
  note: optionalText,
});

export const stockAdjustmentSchema = z.object({
  productVariantId: z.string().uuid("Select a product variant."),
  newQuantity: stockQuantity,
  note: z.string().trim().min(3, "A note is required for manual stock adjustments."),
  referenceType: optionalText,
  referenceId: optionalUuid,
});

export const stockMovementFilterSchema = z.object({
  q: z.string().trim().optional(),
  movementType: z.string().trim().optional(),
  page: z.coerce.number().int().positive().catch(1),
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
export type OpeningCostInput = z.infer<typeof openingCostSchema>;
export type StockEntryInput = z.infer<typeof stockEntrySchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
