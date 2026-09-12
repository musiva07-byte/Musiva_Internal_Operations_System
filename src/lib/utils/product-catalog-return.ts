const CATALOG_BASE_PATH = "/admin/products";

/**
 * Validates a `returnTo` value carried across the Product Catalog → detail → edit → success
 * dialog workflow before it is ever used as a Link href or router.push target. Guards against
 * open redirects: only a same-app path that actually starts with `/admin/products` is
 * accepted. A protocol-relative URL (`//evil.com`), an absolute URL (`http(s)://...`), an
 * embedded newline, or any unrelated internal route falls back to the plain catalog list.
 */
export function getSafeProductCatalogReturnUrl(value: string | null | undefined): string {
  if (!value) return CATALOG_BASE_PATH;
  if (!value.startsWith(CATALOG_BASE_PATH)) return CATALOG_BASE_PATH;
  if (value.startsWith("//")) return CATALOG_BASE_PATH;
  if (/^https?:\/\//i.test(value)) return CATALOG_BASE_PATH;
  if (/[\r\n]/.test(value)) return CATALOG_BASE_PATH;
  return value;
}

/**
 * Appends `?returnTo=<safe catalog url>` (or `&returnTo=...` if `href` already has a query
 * string) so the Product Catalog's page/search/category/status/website/sort position survives
 * a View product / Edit product / Previous / Next navigation. If `returnTo` is empty, `href` is
 * returned unchanged — no point carrying a redundant `returnTo=/admin/products` forward. If
 * `returnTo` is present but fails validation, it's dropped rather than propagated as noise.
 */
export function withProductReturnTo(href: string, returnTo: string | null | undefined): string {
  if (!returnTo) return href;
  const safe = getSafeProductCatalogReturnUrl(returnTo);
  if (safe === CATALOG_BASE_PATH && returnTo !== CATALOG_BASE_PATH) {
    return href;
  }
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(safe)}`;
}
