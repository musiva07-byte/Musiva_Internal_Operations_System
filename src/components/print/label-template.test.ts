/**
 * Structural regression guard for LabelTemplate (delivery label) — same source-text-guard
 * pattern as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "label-template.tsx"), "utf-8");

describe("LabelTemplate — header subtitle", () => {
  it("passes the shortened 'Bahrain' subtitle to BrandMark", () => {
    expect(source).toContain('<BrandMark subtitle="Bahrain" />');
  });

  it("never falls back to the old 'Bahrain Boutique' wording", () => {
    expect(source).not.toContain("Bahrain Boutique");
  });
});

describe("LabelTemplate — payment banner", () => {
  it("shows a plain PAID banner for non-COD orders, with no 'nothing to collect' suffix", () => {
    expect(source).toContain(">PAID</p>");
    expect(source).not.toContain("PAID — NOTHING TO COLLECT");
    expect(source).not.toContain("NOTHING TO COLLECT");
  });

  it("still shows the COD amount-to-collect banner for COD orders", () => {
    expect(source).toContain("AMOUNT TO COLLECT:");
  });
});

describe("LabelTemplate — payment summary section", () => {
  it("no longer renders a duplicate Payment Status field", () => {
    expect(source).not.toContain('label="Payment Status"');
    expect(source).not.toContain("titleize(order.payment_status)");
  });

  it("keeps a single wide Amount Paid field instead", () => {
    expect(source).toContain('label="Amount Paid"');
    expect(source).toContain("formatBhd(order.amount_paid)");
    expect(source).toMatch(/label="Amount Paid"[^]*?size="xl"/);
  });

  it("no longer imports the now-unused titleize helper", () => {
    expect(source).not.toContain('from "@/lib/formatters/labels"');
  });
});

describe("LabelTemplate — preserved behavior", () => {
  it("still supports the compact half-page mode used by the combined print page", () => {
    expect(source).toContain("print-label-compact");
  });

  it("still renders real order/customer/item data, never mock data", () => {
    expect(source).toContain("order.items");
    expect(source).toContain("order.customer");
  });
});
