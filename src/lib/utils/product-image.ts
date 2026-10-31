/**
 * Shared product image rules.
 *
 * A product has at most one image per color (all sizes of a color share it) plus an optional
 * legacy "main" image (color null). Exactly one row is the listing cover (is_primary).
 *
 * Variant image (Stock Management, reports): resolveDisplayImageUrl
 *   1. that color's own image
 *   2. the legacy main image, only for a product with no color photos at all
 *   3. nothing (caller shows a neutral placeholder) — another photo is never passed off as
 *      this color
 *
 * Listing image (Product Catalog, cards): resolveCoverImage
 *
 * Color matching is case-insensitive and trims whitespace, since staff type colors freely and
 * a stray case/space difference between a variant's color and an image's color shouldn't
 * break the match.
 */

export type ProductImageLike = {
  url: string;
  /** Null/undefined for the legacy main image; a color value for a color image. */
  color?: string | null;
  is_primary?: boolean;
};

export function normalizeImageColor(color: string | null | undefined): string | null {
  const trimmed = color?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** Matches next.config.ts remotePatterns: next/image throws on an empty or malformed src and
 *  rejects unconfigured hosts, so anything else must render as a placeholder instead. */
export function isUsableImageUrl(url: string | null | undefined): url is string {
  const src = url?.trim();
  if (!src || /\s/.test(src)) return false;
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname.endsWith(".supabase.co") || parsed.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

export function resolveDisplayImageUrl(
  images: ProductImageLike[],
  color?: string | null,
): string | null {
  const normalizedTarget = normalizeImageColor(color);

  if (normalizedTarget) {
    const colorImage = images.find((img) => normalizeImageColor(img.color) === normalizedTarget);
    if (colorImage) return colorImage.url;
  }

  const hasColorPhotos = images.some((img) => normalizeImageColor(img.color));
  if (normalizedTarget && hasColorPhotos) return null;

  const mainImage = images.find((img) => !normalizeImageColor(img.color));
  return mainImage?.url ?? null;
}

/** The product's listing image: the selected cover, else the legacy main image, else the first
 *  color photo alphabetically (color-only products uploaded before covers existed have no
 *  is_primary row). Ignores rows with an unusable URL so a bad row can't blank the listing. */
export function resolveCoverImage<T extends ProductImageLike>(images: T[]): T | null {
  const usable = images.filter((img) => isUsableImageUrl(img.url));
  return (
    usable.find((img) => img.is_primary) ??
    usable.find((img) => !normalizeImageColor(img.color)) ??
    [...usable].sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""))[0] ??
    null
  );
}

/** "MUSTARD YELLOW" → "Mustard Yellow", for staff messages. */
export function colorDisplayName(color: string): string {
  return color
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export type ColorImageCard<T> = {
  key: string;
  /** Exact color string for image actions; null for the legacy main image. */
  color: string | null;
  label: string;
  image: T | null;
  isCover: boolean;
  kind: "color" | "retired-color" | "general";
};

/**
 * One card per distinct color (sizes of a color collapse into one, grouped by normalized color,
 * never SKU), then any photo whose color is no longer on the product, then the legacy main
 * image. Those last two have no color to file under but can still be the cover, so they must
 * stay visible and manageable.
 */
export function buildColorImageCards<T extends ProductImageLike>(
  colors: string[],
  images: T[],
): ColorImageCard<T>[] {
  const cover = resolveCoverImage(images);
  const cards: ColorImageCard<T>[] = [];
  const seen = new Set<string>();

  for (const color of colors) {
    const key = normalizeImageColor(color);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const image = images.find((img) => normalizeImageColor(img.color) === key) ?? null;
    cards.push({
      key,
      color: color.trim(),
      label: color.trim(),
      image,
      isCover: image !== null && image === cover,
      kind: "color",
    });
  }

  for (const image of images) {
    const key = normalizeImageColor(image.color);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cards.push({
      key,
      color: image.color?.trim() ?? null,
      label: image.color?.trim() ?? "",
      image,
      isCover: image === cover,
      kind: "retired-color",
    });
  }

  const mainImage = images.find((img) => !normalizeImageColor(img.color));
  if (mainImage) {
    cards.push({
      key: "__general__",
      color: null,
      label: "General photo",
      image: mainImage,
      isCover: mainImage === cover,
      kind: "general",
    });
  }

  return cards;
}
