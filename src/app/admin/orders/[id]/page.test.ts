/**
 * Structural regression guard for the Order Detail page — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase). Covers the breadcrumb,
 * "Back to orders" link, status helper text, and simple Previous/Next order navigation added
 * for staff navigation clarity.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Order Detail page — breadcrumb", () => {
  it("renders an Orders > {order number} breadcrumb", () => {
    expect(source).toContain("Breadcrumb");
    expect(source).toMatch(/segments=\{\[\{ label: "Orders", href: "\/admin\/orders" \}, \{ label: order\.order_number \}\]\}/);
  });
});

describe("Order Detail page — back navigation", () => {
  it('has a "Back to orders" link to the orders list', () => {
    expect(source).toContain('<BackLink href="/admin/orders" label="Back to orders" />');
  });
});

describe("Order Detail page — Previous/Next order navigation", () => {
  it("fetches adjacent orders by created_at via getAdjacentOrders", () => {
    expect(source).toContain("getAdjacentOrders(order.id, order.created_at)");
  });

  it("renders the shared PreviousNextNav with Previous order / Next order labels", () => {
    expect(source).toContain("PreviousNextNav");
    expect(source).toContain('previousLabel="Previous order"');
    expect(source).toContain('nextLabel="Next order"');
  });

  it("passes null when there is no adjacent order (PreviousNextNav renders the disabled state)", () => {
    expect(source).toMatch(/previous=\{previousOrder \? \{ id: previousOrder\.id, label: previousOrder\.order_number \} : null\}/);
    expect(source).toMatch(/next=\{nextOrder \? \{ id: nextOrder\.id, label: nextOrder\.order_number \} : null\}/);
  });
});

describe("Order Detail page — status helper text", () => {
  it("shows the short status helper text under the status badge", () => {
    expect(source).toContain("orderStatusHelperText");
    expect(source).toContain("statusHelperText &&");
  });
});
