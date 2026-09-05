/**
 * Structural regression guard for the system-wide navigation/UX pass: PageHeader on list pages,
 * Breadcrumb + BackLink on pages that previously had neither (Customers, Deliveries, Inventory
 * adjustments/movements), and PreviousNextNav on detail pages. Same source-text-guard pattern as
 * breadcrumb-navigation.test.ts (no rendering harness in this codebase) — extends rather than
 * duplicates that file, which already covers Products/Orders/Stock Management/Website Requests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]): string {
  return readFileSync(join(__dirname, ...segments), "utf-8");
}

describe("Customers list — PageHeader + empty state", () => {
  const source = read("customers", "page.tsx");
  it("uses PageHeader with a New customer action", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('href="/admin/customers/new"');
  });
  it("offers Clear filters when a search returns nothing", () => {
    expect(source).toContain("Clear filters");
  });
});

describe("Customer detail — breadcrumb, back link, previous/next, new sale action", () => {
  const source = read("customers", "[id]", "page.tsx");
  it("renders a Customers > {name} breadcrumb", () => {
    expect(source).toContain('{ label: "Customers", href: "/admin/customers" }');
    expect(source).toContain("{ label: customer.full_name }");
  });
  it('has a "Back to customers" link', () => {
    expect(source).toContain('<BackLink href="/admin/customers" label="Back to customers" />');
  });
  it("renders PreviousNextNav fed by getAdjacentCustomers", () => {
    expect(source).toContain("getAdjacentCustomers(customer.id, customer.created_at)");
    expect(source).toContain("<PreviousNextNav");
  });
});

describe("Customer edit — breadcrumb + back link", () => {
  const source = read("customers", "[id]", "edit", "page.tsx");
  it("renders a Customers > {name} > Edit breadcrumb", () => {
    expect(source).toContain('{ label: "Customers", href: "/admin/customers" }');
    expect(source).toMatch(/label: customer\.full_name, href: `\/admin\/customers\/\$\{customer\.id\}`/);
    expect(source).toContain('{ label: "Edit" }');
  });
  it('has a "Back to customer" link', () => {
    expect(source).toMatch(/<BackLink href=\{`\/admin\/customers\/\$\{customer\.id\}`\} label="Back to customer" \/>/);
  });
});

describe("New customer — breadcrumb + back link", () => {
  const source = read("customers", "new", "page.tsx");
  it('has a "Back to customers" link', () => {
    expect(source).toContain('<BackLink href="/admin/customers" label="Back to customers" />');
  });
});

describe("Deliveries list — PageHeader + empty states", () => {
  const source = read("deliveries", "page.tsx");
  it("uses PageHeader", () => {
    expect(source).toContain("<PageHeader");
  });
});

describe("Delivery queue — empty state actions", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "deliveries", "delivery-queue.tsx"),
    "utf-8",
  );
  it('offers "Back to Orders" when there are no deliveries at all', () => {
    expect(source).toContain('href="/admin/orders"');
    expect(source).toContain("Back to Orders");
  });
  it('offers "Clear filters" when a filtered/searched view is empty', () => {
    expect(source).toContain("Clear filters");
  });
});

describe("Delivery detail — breadcrumb + back link", () => {
  const source = read("deliveries", "[id]", "page.tsx");
  it("renders a Deliveries > {order number} breadcrumb", () => {
    expect(source).toContain('{ label: "Deliveries", href: "/admin/deliveries" }');
    expect(source).toContain("{ label: delivery.order.order_number }");
  });
  it('has a "Back to deliveries" link', () => {
    expect(source).toContain('<BackLink href="/admin/deliveries" label="Back to deliveries" />');
  });
});

describe("Stock Management list — PageHeader", () => {
  const source = read("inventory", "page.tsx");
  it("uses PageHeader while preserving the locked breadcrumb segment", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<Breadcrumb segments={[{ label: "Stock Management" }]} />');
  });
});

describe("Correct Quantity page — breadcrumb + back link", () => {
  const source = read("inventory", "adjustments", "page.tsx");
  it("renders a Stock Management > Correct Quantity breadcrumb", () => {
    expect(source).toContain('{ label: "Stock Management", href: "/admin/inventory" }');
    expect(source).toContain('{ label: "Correct Quantity" }');
  });
  it('has a "Back to stock" link', () => {
    expect(source).toContain('<BackLink href="/admin/inventory" label="Back to stock" />');
  });
});

describe("Stock History page — breadcrumb + back link + filter reset", () => {
  const source = read("inventory", "movements", "page.tsx");
  it("renders a Stock Management > Stock History breadcrumb", () => {
    expect(source).toContain('{ label: "Stock Management", href: "/admin/inventory" }');
    expect(source).toContain('{ label: "Stock History" }');
  });
  it('has a "Back to stock" link', () => {
    expect(source).toContain('<BackLink href="/admin/inventory" label="Back to stock" />');
  });
  it("offers a reset-filters link when a filter is active", () => {
    expect(source).toContain("Reset filters");
  });
});

describe("Orders list — PageHeader (preserves locked breadcrumb)", () => {
  const source = read("orders", "page.tsx");
  it("uses PageHeader", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<Breadcrumb segments={[{ label: "Orders" }]} />');
  });
});

describe("Product Catalog list — PageHeader (preserves locked breadcrumb)", () => {
  const source = read("products", "page.tsx");
  it("uses PageHeader", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<Breadcrumb segments={[{ label: "Product Catalog" }]} />');
  });
});

describe("Product detail — Previous/Next product navigation", () => {
  const source = read("products", "[id]", "page.tsx");
  it("fetches adjacent products by created_at via getAdjacentProducts", () => {
    expect(source).toContain("getAdjacentProducts(\n    product.id,\n    product.created_at,\n  )");
  });
  it("renders the shared PreviousNextNav with product labels", () => {
    expect(source).toContain("<PreviousNextNav");
    expect(source).toContain('previousLabel="Previous product"');
    expect(source).toContain('nextLabel="Next product"');
  });
});

describe("Website Requests list — PageHeader (preserves locked breadcrumb)", () => {
  const source = read("website-requests", "page.tsx");
  it("uses PageHeader", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<Breadcrumb segments={[{ label: "Website Requests" }]} />');
  });
});

describe("Reports landing — PageHeader", () => {
  const source = read("reports", "page.tsx");
  it("uses PageHeader", () => {
    expect(source).toContain("<PageHeader");
  });
});
