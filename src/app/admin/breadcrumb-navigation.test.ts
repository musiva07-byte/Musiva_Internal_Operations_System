/**
 * Structural regression guard for breadcrumb/back-link navigation across the pages named in
 * the navigation-simplification task: Product Catalog (list/detail/edit), Stock Management
 * (list + Receive Stock), and Website Requests (list/detail). Order pages have their own more
 * detailed guard files. Same source-text-guard pattern as product-cost-dialog.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]): string {
  return readFileSync(join(__dirname, ...segments), "utf-8");
}

describe("Product Catalog list — breadcrumb", () => {
  const source = read("products", "page.tsx");
  it('renders a single "Product Catalog" breadcrumb segment', () => {
    expect(source).toContain('<Breadcrumb segments={[{ label: "Product Catalog" }]} />');
  });
});

describe("Product detail — breadcrumb + back link", () => {
  const source = read("products", "[id]", "page.tsx");
  it("renders a Product Catalog > {product name} breadcrumb", () => {
    expect(source).toContain('{ label: "Product Catalog", href: "/admin/products" }');
    expect(source).toContain("{ label: product.name }");
  });
  it('has a "Back to catalog" link', () => {
    expect(source).toContain('<BackLink href="/admin/products" label="Back to catalog" />');
  });
});

describe("Product edit — breadcrumb + back link", () => {
  const source = read("products", "[id]", "edit", "page.tsx");
  it("renders a Product Catalog > {product name} > Edit breadcrumb", () => {
    expect(source).toContain('{ label: "Product Catalog", href: "/admin/products" }');
    expect(source).toMatch(/label: product\.name, href: `\/admin\/products\/\$\{product\.id\}`/);
    expect(source).toContain('{ label: "Edit" }');
  });
  it('has a "Back to product" link', () => {
    expect(source).toMatch(/<BackLink href=\{`\/admin\/products\/\$\{product\.id\}`\} label="Back to product" \/>/);
  });
});

describe("Stock Management list — breadcrumb", () => {
  const source = read("inventory", "page.tsx");
  it('renders a single "Stock Management" breadcrumb segment', () => {
    expect(source).toContain('<Breadcrumb segments={[{ label: "Stock Management" }]} />');
  });
});

describe("Receive Stock — breadcrumb + back link", () => {
  const source = read("inventory", "stock-entry", "page.tsx");
  it("renders a Stock Management > Receive Stock breadcrumb", () => {
    expect(source).toContain('{ label: "Stock Management", href: "/admin/inventory" }');
    expect(source).toContain('{ label: "Receive Stock" }');
  });
  it('has a "Back to stock" link', () => {
    expect(source).toContain('<BackLink href="/admin/inventory" label="Back to stock" />');
  });
});

describe("Website Requests list — breadcrumb", () => {
  const source = read("website-requests", "page.tsx");
  it('renders a single "Website Requests" breadcrumb segment', () => {
    expect(source).toContain('<Breadcrumb segments={[{ label: "Website Requests" }]} />');
  });
});

describe("Website Request detail — breadcrumb + back link", () => {
  const source = read("website-requests", "[id]", "page.tsx");
  it("renders a Website Requests > {request number} breadcrumb", () => {
    expect(source).toContain('{ label: "Website Requests", href: "/admin/website-requests" }');
    expect(source).toContain("{ label: request.request_number }");
  });
  it('has a "Back to website requests" link', () => {
    expect(source).toContain('<BackLink href="/admin/website-requests" label="Back to website requests" />');
  });
});

describe("Reports sub-pages — Back to reports", () => {
  const pages = [
    ["reports", "sales", "page.tsx"],
    ["reports", "customers", "page.tsx"],
    ["reports", "finance", "page.tsx"],
    ["reports", "inventory", "page.tsx"],
    ["reports", "product-costs", "page.tsx"],
  ];

  for (const segments of pages) {
    it(`${segments.join("/")} has a "Back to reports" link`, () => {
      const source = read(...segments);
      expect(source).toContain('<BackLink href="/admin/reports" label="Back to reports" />');
    });
  }
});
