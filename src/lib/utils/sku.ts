/**
 * Generate a product SKU/code from the product name.
 * e.g. "Western Top" → "WES-TOP", "Satin Dress" → "SAT-DRE"
 * If name has no usable characters, use a timestamp fallback.
 */
export function generateProductSku(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return `SKU-${Date.now().toString(36).toUpperCase()}`;
  }

  return words.slice(0, 3).map((word) => word.slice(0, 3)).join("-");
}

/** Max color words folded into the option code, so a long mixed-color name still
 *  produces a short, readable code (e.g. "Black & White" → "BLA-WHI"). */
const MAX_COLOR_CODE_WORDS = 3;

/**
 * Split a mixed/combined color name into per-word codes instead of one 3-letter
 * blob, so "Black & White" and "Black&Pink" produce a code per color rather than
 * losing the second color entirely. Only "&", "/", and whitespace are treated as
 * word separators — a hyphen stays inside a word ("Off-White" → one word, "OFF"),
 * since a hyphenated name is more often a single shade than two combined colors.
 */
function colorCode(color: string): string {
  const words = color
    .trim()
    .toUpperCase()
    .split(/[\s&/]+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  return words.slice(0, MAX_COLOR_CODE_WORDS).map((word) => word.slice(0, 3)).join("-");
}

/**
 * Generate a variant SKU ("option code") from a product SKU and color/size.
 * e.g. "05T", "BLACK", "XL" → "05T-BLA-XL"
 * e.g. "05T", "Black & White", "Free Size" → "05T-BLA-WHI-FRE"
 */
export function generateVariantSku(productSku: string, color: string, size: string): string {
  const sizeCode = size
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

  return [productSku, colorCode(color), sizeCode].filter(Boolean).join("-");
}

/** Safety cap so a pathological run of collisions can never loop forever. */
const MAX_SUFFIX_ATTEMPTS = 200;

/**
 * Resolve a unique SKU/code by appending a numeric suffix ("-2", "-3", ...)
 * until `isTaken` reports the candidate is free. Only ever called for
 * auto-generated codes — a staff-entered code that collides should be
 * reported as a conflict instead of silently changed.
 *
 * Returns null if no unique candidate could be found within the safety cap
 * (the caller should show a friendly "please try again" message).
 */
export async function resolveUniqueSku(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string | null> {
  if (!(await isTaken(base))) {
    return base;
  }

  for (let suffix = 2; suffix <= MAX_SUFFIX_ATTEMPTS; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  return null;
}
