/**
 * Structural regression guard for OrderQueue — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase). Covers the
 * "In Fulfilment" -> "Preparing" tab label, tab-specific empty states, the "All order types"
 * filter label, and the Clear filters / New sale empty-state actions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "order-queue.tsx"), "utf-8");

describe("OrderQueue — tabs use the Preparing label", () => {
  it('labels the in_fulfilment tab "Preparing", never "In Fulfilment"', () => {
    expect(source).toContain('{ id: "in_fulfilment", label: "Preparing", countKey: "in_fulfilment" }');
    expect(source).not.toContain("In Fulfilment");
  });

  it("keeps the internal tab id/countKey unchanged (in_fulfilment)", () => {
    expect(source).toContain('type Tab = "today" | "new" | "confirmed" | "in_fulfilment"');
  });
});

describe("OrderQueue — tab-specific empty states", () => {
  it("has distinct, tab-specific copy for every tab", () => {
    expect(source).toContain('today: { title: "No orders today yet." }');
    expect(source).toContain('title: "No new orders right now."');
    expect(source).toContain("Orders waiting for confirmation will appear here.");
    expect(source).toContain('title: "No confirmed orders waiting."');
    expect(source).toContain("Confirmed orders will appear here before preparation.");
    expect(source).toContain('title: "No orders being prepared right now."');
    expect(source).toContain("Packed, pickup, and delivery orders will appear here.");
    expect(source).toContain('title: "No completed orders found for this view."');
    expect(source).toContain('title: "No cancelled orders found."');
    expect(source).toContain('all: { title: "No orders found." }');
  });

  it("shows a Clear filters action only when a filter is active", () => {
    expect(source).toContain("hasActiveFilters &&");
    expect(source).toContain("Clear filters");
  });

  it("shows a New sale action in the tab-specific empty state", () => {
    expect(source).toMatch(/No orders yet\.[\s\S]*New sale/);
    expect(source).toMatch(/EMPTY_STATE_COPY\[currentTab as Tab\][\s\S]*New sale/);
  });
});

describe("OrderQueue — filter labels", () => {
  it('uses "All order types" instead of "All fulfilment"', () => {
    expect(source).toContain('<option value="">All order types</option>');
    expect(source).not.toContain("All fulfilment");
  });

  it("keeps clear fulfilment method labels", () => {
    expect(source).toContain('<option value="delivery">Delivery</option>');
    expect(source).toContain('<option value="walk_in">Walk-in</option>');
    expect(source).toContain('<option value="customer_pickup">Pickup</option>');
  });
});
