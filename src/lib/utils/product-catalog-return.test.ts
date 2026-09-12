/**
 * Tests for the Product Catalog return-context helpers. These back the fix for a real staff
 * complaint: opening a product from page 5 of a filtered catalog, editing it, and clicking
 * "Back to catalog" used to always land on page 1 with filters cleared. getSafeProductCatalogReturnUrl
 * and withProductReturnTo are pure functions, so — unlike most of this codebase's page-level
 * navigation guards — these can be tested with real assertions instead of source-text matching.
 */
import { describe, it, expect } from "vitest";
import { getSafeProductCatalogReturnUrl, withProductReturnTo } from "./product-catalog-return";

describe("getSafeProductCatalogReturnUrl", () => {
  it("accepts a plain catalog URL", () => {
    expect(getSafeProductCatalogReturnUrl("/admin/products")).toBe("/admin/products");
  });

  it("accepts a filtered catalog URL with page/search/category/status/website params", () => {
    const url = "/admin/products?page=5&q=kurthi&category=kaftan&status=active&website=published";
    expect(getSafeProductCatalogReturnUrl(url)).toBe(url);
  });

  it("falls back to the plain catalog list when no value is given", () => {
    expect(getSafeProductCatalogReturnUrl(undefined)).toBe("/admin/products");
    expect(getSafeProductCatalogReturnUrl(null)).toBe("/admin/products");
    expect(getSafeProductCatalogReturnUrl("")).toBe("/admin/products");
  });

  it("rejects a value that does not start with /admin/products", () => {
    expect(getSafeProductCatalogReturnUrl("/admin/orders")).toBe("/admin/products");
    expect(getSafeProductCatalogReturnUrl("/admin")).toBe("/admin/products");
  });

  it("rejects a protocol-relative URL (open redirect via //)", () => {
    expect(getSafeProductCatalogReturnUrl("//evil.com")).toBe("/admin/products");
  });

  it("rejects an absolute http(s) URL even if it superficially starts with the right path", () => {
    expect(getSafeProductCatalogReturnUrl("https://evil.com/admin/products")).toBe("/admin/products");
    expect(getSafeProductCatalogReturnUrl("http://evil.com")).toBe("/admin/products");
  });

  it("rejects a value containing embedded newlines", () => {
    expect(getSafeProductCatalogReturnUrl("/admin/products?q=a\nSet-Cookie: x=y")).toBe("/admin/products");
  });
});

describe("withProductReturnTo", () => {
  it("returns the bare href when no returnTo is provided", () => {
    expect(withProductReturnTo("/admin/products/123", undefined)).toBe("/admin/products/123");
    expect(withProductReturnTo("/admin/products/123", "")).toBe("/admin/products/123");
  });

  it("appends a safe returnTo as a query param", () => {
    expect(withProductReturnTo("/admin/products/123", "/admin/products?page=5")).toBe(
      "/admin/products/123?returnTo=%2Fadmin%2Fproducts%3Fpage%3D5",
    );
  });

  it("appends with & when the href already has a query string", () => {
    expect(withProductReturnTo("/admin/products/123/edit?tab=cost", "/admin/products?page=5")).toBe(
      "/admin/products/123/edit?tab=cost&returnTo=%2Fadmin%2Fproducts%3Fpage%3D5",
    );
  });

  it("drops an unsafe returnTo instead of propagating a meaningless fallback", () => {
    expect(withProductReturnTo("/admin/products/123", "https://evil.com")).toBe("/admin/products/123");
    expect(withProductReturnTo("/admin/products/123", "//evil.com")).toBe("/admin/products/123");
  });

  it("round-trips exactly the example scenario from the staff complaint", () => {
    const sourceCatalogUrl = "/admin/products?page=5&q=kurthi&category=kaftan&website=published";
    const productHref = withProductReturnTo("/admin/products/abc-123", sourceCatalogUrl);
    expect(productHref).toBe(`/admin/products/abc-123?returnTo=${encodeURIComponent(sourceCatalogUrl)}`);
    // And the receiving page recovers the exact original URL from that param.
    const recovered = new URL(productHref, "https://example.test").searchParams.get("returnTo");
    expect(getSafeProductCatalogReturnUrl(recovered)).toBe(sourceCatalogUrl);
  });
});
