/**
 * Generate a product SKU from the product name.
 * e.g. "Satin Dress" → "MSV-SAT-DRS"
 * If name is blank, use timestamp fallback.
 */
export function generateProductSku(name: string): string {
  if (!name.trim()) {
    return `MSV-${Date.now().toString(36).toUpperCase()}`;
  }

  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const parts = words.slice(0, 3).map((word) => word.slice(0, 3));
  return `MSV-${parts.join("-")}`;
}

/**
 * Generate a variant SKU from a product SKU and color/size.
 * e.g. "MSV-SAT-DRS", "Black", "M" → "MSV-SAT-DRS-BLK-M"
 */
export function generateVariantSku(productSku: string, color: string, size: string): string {
  const colorCode = color
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  const sizeCode = size
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

  return [productSku, colorCode, sizeCode].filter(Boolean).join("-");
}
