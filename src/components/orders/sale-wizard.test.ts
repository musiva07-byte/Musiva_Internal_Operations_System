/**
 * Structural guard for the New Sale item picker's "no results" empty state — same
 * source-text-guard pattern as breadcrumb.test.ts (no rendering harness in this codebase).
 * This copy was added as part of the staff-workflow stability pass after the 2026-09-12
 * product-code search incident (see AGENTS.md section 41, context/staff-workflow-smoke-tests.md).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "sale-wizard.tsx"), "utf-8");

describe("New Sale item picker — no-results empty state", () => {
  it("shows the friendly no-results heading", () => {
    expect(source).toContain("No matching sellable product found.");
  });

  it("explains what fields are searched and that website-hidden products are included", () => {
    expect(source).toContain("Search checks product name, code, color, size, and category.");
    expect(source).toContain("Website hidden products are included if active and in stock.");
  });

  it("points staff at the out-of-stock toggle when relevant", () => {
    expect(source).toMatch(/If the product exists but has no stock, enable/);
    expect(source).toContain("Show out-of-stock");
  });

  it("offers Clear search, Open Product Catalog, and (if permitted) Add new product", () => {
    expect(source).toContain("Clear search");
    expect(source).toContain("Open Product Catalog");
    expect(source).toContain('href="/admin/products/new"');
    expect(source).toContain("canAddProduct &&");
  });

  it('offers a "still can\'t find it" helper pointing to Product Catalog / admin', () => {
    expect(source).toContain("Still can");
    expect(source).toContain("find it?");
    expect(source).toContain("contact admin with the product");
  });

  it("never shows technical/raw error details in the empty state", () => {
    const emptyStateMatch = source.match(
      /No matching sellable product found\.[\s\S]*?find it\?[\s\S]*?<\/p>/,
    );
    expect(emptyStateMatch).not.toBeNull();
    const emptyStateBlock = emptyStateMatch![0];
    expect(emptyStateBlock).not.toMatch(/postgres|supabase|stack|exception|undefined/i);
  });
});
