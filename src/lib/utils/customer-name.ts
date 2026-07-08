/**
 * Validates a customer full name.
 *
 * Rules:
 * - Trims whitespace first
 * - Requires at least 2 visible characters after trimming
 * - Allows Unicode letters (Arabic, English, and any other script), spaces,
 *   hyphens, apostrophes, and dots
 * - Does NOT reject non-English names
 */
export function isValidCustomerName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // \p{L} matches any Unicode letter (Arabic, Latin, etc.)
  // \p{M} matches combining marks (diacritics)
  return /^[\p{L}\p{M}\s'\-.]+$/u.test(trimmed);
}

/**
 * Returns a human-readable error message for an invalid customer name,
 * or null if the name is valid.
 */
export function customerNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Enter the customer name to register.";
  if (trimmed.length < 2) return "Customer name must be at least 2 characters.";
  if (!/^[\p{L}\p{M}\s'\-.]+$/u.test(trimmed)) {
    return "Customer name contains invalid characters.";
  }
  return null;
}
