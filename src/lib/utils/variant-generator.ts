import { generateVariantSku } from "./sku";

export type GeneratedVariant = {
  color: string;
  size: string;
  variantSku: string;
  regularSellingPriceBhd: number;
  sellingPrice: number;
  costPrice: number;
  discountPrice: null;
  discountPriceBhd: null;
  discountStartAt: null;
  discountEndAt: null;
  barcode: null;
  stockQuantity: number;
  minimumStock: number;
  status: "active";
};

/**
 * Generate all color × size combinations from two chip lists.
 * The generated variants are sorted: color first, then size (preserving chip order).
 */
export function generateVariants(
  productSku: string,
  colors: string[],
  sizes: string[],
  defaults: {
    regularSellingPriceBhd: number;
    stockQuantity: number;
    minimumStock: number;
  },
): GeneratedVariant[] {
  const variants: GeneratedVariant[] = [];

  for (const color of colors) {
    for (const size of sizes) {
      variants.push({
        color,
        size,
        variantSku: generateVariantSku(productSku, color, size),
        regularSellingPriceBhd: defaults.regularSellingPriceBhd,
        sellingPrice: defaults.regularSellingPriceBhd,
        costPrice: 0,
        discountPrice: null,
        discountPriceBhd: null,
        discountStartAt: null,
        discountEndAt: null,
        barcode: null,
        stockQuantity: defaults.stockQuantity,
        minimumStock: defaults.minimumStock,
        status: "active",
      });
    }
  }

  return variants;
}
