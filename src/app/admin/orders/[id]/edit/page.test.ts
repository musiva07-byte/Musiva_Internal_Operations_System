/**
 * Structural regression guard for the Order Edit page — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase). Covers the
 * Orders > {order number} > Edit breadcrumb and the "Back to order" link, for both the
 * unauthorized-role branch and the main editable branch.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Order Edit page — breadcrumb", () => {
  it("renders an Orders > {order number} > Edit breadcrumb", () => {
    expect(source).toContain("Breadcrumb");
    expect(source).toMatch(/label: order\.order_number, href: `\/admin\/orders\/\$\{order\.id\}`/);
    expect(source).toMatch(/\{ label: "Edit" \}/);
  });

  it("renders the breadcrumb on both the unauthorized branch and the editable branch", () => {
    const matches = source.match(/<Breadcrumb/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Order Edit page — back navigation", () => {
  it('has a "Back to order" link to the order detail page on both branches', () => {
    const matches = source.match(/<BackLink href=\{`\/admin\/orders\/\$\{order\.id\}`\} label="Back to order" \/>/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
