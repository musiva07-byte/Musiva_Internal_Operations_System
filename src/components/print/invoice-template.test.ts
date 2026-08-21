/**
 * Structural regression guard for InvoiceTemplate (receipt) — same source-text-guard pattern
 * as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "invoice-template.tsx"), "utf-8");

describe("InvoiceTemplate — header subtitle", () => {
  it("passes the shortened 'Bahrain' subtitle to BrandMark", () => {
    expect(source).toContain('<BrandMark subtitle="Bahrain" />');
  });

  it("never falls back to the old 'Bahrain Boutique' wording", () => {
    expect(source).not.toContain("Bahrain Boutique");
  });
});

describe("InvoiceTemplate — preserved behavior", () => {
  it("still supports the compact half-page mode used by the combined print page", () => {
    expect(source).toContain("print-invoice-compact");
  });

  it("still shows the payment status field and the Amount Paid total (not duplicated further)", () => {
    expect(source).toContain("titleize(order.payment_status)");
    expect(source).toContain('label="Amount Paid"');
  });

  it("still renders real order/customer/item data, never mock data", () => {
    expect(source).toContain("order.items");
    expect(source).toContain("order.customer");
  });
});
