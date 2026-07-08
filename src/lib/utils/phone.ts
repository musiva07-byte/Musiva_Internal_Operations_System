/**
 * Bahrain phone normalization.
 *
 * Normalizes all common Bahrain mobile number formats to a canonical E.164 form
 * without the leading "+": "97312345678" (11 digits).
 *
 * Accepted input formats:
 *   33331101          → 97333331101  (8-digit local)
 *   +97333331101      → 97333331101  (E.164 with +)
 *   +973 3333 1101    → 97333331101  (E.164 with spaces)
 *   00973 3333 1101   → 97333331101  (international prefix 00)
 *   973-3333-1101     → 97333331101  (dashes)
 */
export function normalizeBahrainPhone(input: string): string | null {
  if (!input) return null;

  // Strip all whitespace, dashes, parentheses
  const stripped = input.replace(/[\s\-().]/g, "");

  // Remove leading +
  const withoutPlus = stripped.startsWith("+") ? stripped.slice(1) : stripped;

  // Remove leading 00
  const withoutDoubleZero = withoutPlus.startsWith("00")
    ? withoutPlus.slice(2)
    : withoutPlus;

  // Now withoutDoubleZero should be either "973XXXXXXXX" or "XXXXXXXX" (8 digits)
  if (withoutDoubleZero.startsWith("973")) {
    const local = withoutDoubleZero.slice(3);
    if (local.length === 8 && /^\d{8}$/.test(local)) {
      return `973${local}`;
    }
    return null;
  }

  // 8-digit local number
  if (/^\d{8}$/.test(withoutDoubleZero)) {
    return `973${withoutDoubleZero}`;
  }

  return null;
}

/**
 * Format a normalized phone number for display: "+973 XXXX XXXX"
 */
export function formatBahrainPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("973")) {
    const local = digits.slice(3);
    return `+973 ${local.slice(0, 4)} ${local.slice(4)}`;
  }
  return normalized;
}

/**
 * Returns true when two raw phone inputs resolve to the same normalized number.
 */
export function isSameBahrainPhone(a: string, b: string): boolean {
  const na = normalizeBahrainPhone(a);
  const nb = normalizeBahrainPhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
