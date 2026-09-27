export const ELLIPSIS = "ellipsis" as const;

/**
 * Builds the page-number list with ellipses for large page counts — e.g. for page 5 of 20:
 * [1, "ellipsis", 4, 5, 6, "ellipsis", 20]. Totals of 7 or fewer always show every page (matches
 * "Previous 1 2 3 4 5 Next" for a 5-page catalog, regardless of which page is current).
 */
export function getPageNumbers(current: number, total: number): (number | typeof ELLIPSIS)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const delta = 1;
  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);

  const pages: (number | typeof ELLIPSIS)[] = [1];
  if (rangeStart > 2) pages.push(ELLIPSIS);
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < total - 1) pages.push(ELLIPSIS);
  pages.push(total);
  return pages;
}

export type GoToPageResult = { ok: true; page: number } | { ok: false; error: string };

/**
 * Validates a staff-typed "Go to page" value. Never throws and never lets an out-of-range page
 * through — blank, zero, negative, non-integer, or greater-than-total all return a friendly
 * inline error instead of navigating.
 */
export function parseGoToPage(value: string, pageCount: number): GoToPageResult {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (!trimmed || !Number.isInteger(parsed) || parsed < 1 || parsed > pageCount) {
    return { ok: false, error: `Enter a page between 1 and ${pageCount}.` };
  }
  return { ok: true, page: parsed };
}
