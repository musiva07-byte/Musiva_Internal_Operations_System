/**
 * Structural regression guard for the Product Catalog return-context fix: staff on a filtered
 * catalog page (e.g. page 5, search "kurthi") who open/edit a product and click "Back to
 * catalog" must return to that exact page/filter position, not page 1. Same source-text-guard
 * pattern as breadcrumb-navigation.test.ts (no rendering harness in this codebase). Real
 * validation logic is covered separately in product-catalog-return.test.ts; this file locks
 * down that every navigation point actually wires that logic in.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]): string {
  return readFileSync(join(__dirname, ...segments), "utf-8");
}

function readComponent(...segments: string[]): string {
  return readFileSync(join(__dirname, "..", "..", "..", "components", ...segments), "utf-8");
}

describe("Product Catalog list — builds and forwards returnTo", () => {
  const source = read("page.tsx");

  it("builds catalogReturnTo from every incoming query param, not just the known filters", () => {
    expect(source).toContain("const catalogReturnTo = (() => {");
    expect(source).toContain("for (const [key, value] of Object.entries(params))");
  });

  it("passes returnTo to ProductRowActions (View product / Edit product row actions)", () => {
    expect(source).toMatch(/<ProductRowActions\s*\n\s*productId=\{product\.id\}\s*\n\s*returnTo=\{catalogReturnTo\}/);
  });

  it("carries returnTo on the product-name link (the most common way staff open a product)", () => {
    expect(source).toContain(
      "href={withProductReturnTo(`/admin/products/${product.id}`, catalogReturnTo)}",
    );
  });

  it("pagination preserves search/category/status/website filters on Previous/Next", () => {
    expect(source).toContain("const hrefForPage = (nextPage: number) => {");
    expect(source).toContain('if (q) next.set("q", q);');
    expect(source).toContain('if (status) next.set("status", status);');
    expect(source).toContain('if (categoryId !== "all") next.set("categoryId", categoryId);');
    expect(source).toContain('if (website) next.set("website", website);');
  });

  it("the filter form has no hidden page field, so submitting a filter change resets to page 1 (and only then)", () => {
    const formMatch = source.match(/<form className="grid gap-3[^>]*>[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).not.toContain('name="page"');
  });
});

describe("ProductRowActions — View/Edit/Change image links carry returnTo", () => {
  const source = readComponent("products", "product-row-actions.tsx");

  it("accepts a returnTo prop", () => {
    expect(source).toContain("returnTo?: string");
  });

  it("View product link uses withProductReturnTo", () => {
    expect(source).toContain(
      '<Link href={withProductReturnTo(`/admin/products/${productId}`, returnTo)}>View product</Link>',
    );
  });

  it("Edit product link uses withProductReturnTo", () => {
    expect(source).toContain(
      '<Link href={withProductReturnTo(`/admin/products/${productId}/edit`, returnTo)}>Edit product</Link>',
    );
  });

  it("Change image link uses withProductReturnTo", () => {
    expect(source).toMatch(
      /<Link href=\{withProductReturnTo\(`\/admin\/products\/\$\{productId\}`, returnTo\)\}>\s*<ImageIcon/,
    );
  });
});

describe("Product Detail — reads returnTo and uses it safely", () => {
  const source = read("[id]", "page.tsx");

  it("reads returnTo from searchParams and validates it via getSafeProductCatalogReturnUrl", () => {
    expect(source).toContain("searchParams: Promise<Record<string, string | string[] | undefined>>");
    expect(source).toContain("const safeReturnTo = getSafeProductCatalogReturnUrl(returnTo)");
  });

  it('"Back to catalog" BackLink uses the validated safeReturnTo', () => {
    expect(source).toContain('<BackLink href={safeReturnTo} label="Back to catalog" />');
  });

  it("Edit product button preserves returnTo", () => {
    expect(source).toContain(
      "href={withProductReturnTo(`/admin/products/${product.id}/edit`, returnTo)}",
    );
  });

  it("Previous/Next product navigation preserves returnTo unchanged", () => {
    expect(source).toContain(
      "hrefFor={(productId) => withProductReturnTo(`/admin/products/${productId}`, returnTo)}",
    );
  });
});

describe("Product Edit page — preserves returnTo through Back to product and success flows", () => {
  const source = read("[id]", "edit", "page.tsx");

  it("reads returnTo from searchParams", () => {
    expect(source).toContain("searchParams: Promise<Record<string, string | string[] | undefined>>");
    expect(source).toContain("const rawReturnTo = resolvedSearchParams.returnTo");
  });

  it('"Back to product" BackLink preserves returnTo', () => {
    expect(source).toMatch(
      /<BackLink\s+href=\{withProductReturnTo\(`\/admin\/products\/\$\{product\.id\}`, returnTo\)\}\s+label="Back to product"\s*\/>/,
    );
  });

  it("forwards returnTo into ProductForm so Cancel and the success dialog can use it", () => {
    expect(source).toMatch(/<ProductForm[\s\S]*returnTo=\{returnTo\}[\s\S]*\/>/);
  });
});

describe("ProductForm — Cancel and save-success dialog use returnTo", () => {
  const source = readComponent("products", "product-form.tsx");

  it("accepts a returnTo prop", () => {
    expect(source).toContain("returnTo?: string");
  });

  it("Cancel returns to the product detail page with returnTo preserved (not router.back())", () => {
    expect(source).toContain("router.push(withProductReturnTo(`/admin/products/${product.id}`, returnTo));");
  });

  it('success dialog "Back to catalog" uses the validated safe return URL', () => {
    expect(source).toContain("router.push(getSafeProductCatalogReturnUrl(returnTo));");
  });

  it('success dialog "View product" preserves returnTo', () => {
    expect(source).toContain(
      "router.push(withProductReturnTo(`/admin/products/${successInfo.productId}`, returnTo));",
    );
  });

  it("Continue editing keeps the current edit page (no navigation, returnTo untouched)", () => {
    expect(source).toContain("onContinueEditing={() => {\n            setSuccessInfo(null);\n          }}");
  });
});

describe("ProductSaveSuccessDialog — optional return-context hint", () => {
  const source = readComponent("products", "product-save-success-dialog.tsx");

  it("accepts hasFilteredReturn and shows a helper hint when true", () => {
    expect(source).toContain("hasFilteredReturn?: boolean");
    expect(source).toContain("Returns to your previous catalog view.");
  });
});
