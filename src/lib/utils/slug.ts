/**
 * Convert free text into a URL-safe slug.
 * "A line top" -> "a-line-top"
 * "Pearl Trim Abaya" -> "pearl-trim-abaya"
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique product slug from the product name, falling back to the
 * SKU (and finally a timestamp) when the name has no usable characters.
 *
 * On a collision, the slugified SKU is appended — e.g. "Pearl Trim Abaya"
 * with SKU "MSV-10001" becomes "pearl-trim-abaya-msv-10001" if
 * "pearl-trim-abaya" is already taken. `isTaken` should exclude the
 * product's own current slug when regenerating for an existing product.
 */
export async function generateUniqueProductSlug(
  name: string,
  sku: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name) || slugify(sku) || `product-${Date.now().toString(36)}`;

  if (!(await isTaken(base))) {
    return base;
  }

  const withSku = `${base}-${slugify(sku)}`;
  if (!(await isTaken(withSku))) {
    return withSku;
  }

  let suffix = 2;
  let candidate = `${withSku}-${suffix}`;
  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${withSku}-${suffix}`;
  }
  return candidate;
}
