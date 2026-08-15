/**
 * Shared image fallback rule used everywhere a product/variant image is displayed:
 *   1. that color's own image, if one was uploaded
 *   2. the product's main image
 *   3. nothing (caller shows a placeholder)
 *
 * Color matching is case-insensitive and trims whitespace, since staff type colors
 * freely (see product-wizard.tsx's mixed-color support) and a stray case/space
 * difference between a variant's color and the image's color shouldn't break the match.
 */

export type ProductImageLike = {
  url: string;
  /** Null/undefined for the main product image; a color value for a color image. */
  color?: string | null;
};

function normalizeColor(color: string | null | undefined): string | null {
  const trimmed = color?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function resolveDisplayImageUrl(
  images: ProductImageLike[],
  color?: string | null,
): string | null {
  const normalizedTarget = normalizeColor(color);

  if (normalizedTarget) {
    const colorImage = images.find((img) => normalizeColor(img.color) === normalizedTarget);
    if (colorImage) return colorImage.url;
  }

  const mainImage = images.find((img) => !normalizeColor(img.color));
  return mainImage?.url ?? null;
}
