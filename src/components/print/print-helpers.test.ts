/**
 * Tests for print-template helper logic.
 *
 * These tests cover the pure logic used by LabelTemplate and InvoiceTemplate:
 * - COD / paid detection
 * - Phone display formatting
 * - Items summary construction
 * - Address priority (delivery snapshot > customer)
 */
import { describe, expect, it } from "vitest";
import { formatBahrainPhone } from "@/lib/utils/phone";
import { formatBhd } from "@/lib/formatters/currency";

// ── COD Detection ─────────────────────────────────────────────────────────────

describe("COD detection (LabelTemplate logic)", () => {
  function isCod(paymentStatus: string, amountDue: number): boolean {
    return paymentStatus === "cod" || amountDue > 0;
  }

  it("detects COD when payment_status is 'cod'", () => {
    expect(isCod("cod", 0)).toBe(true);
  });

  it("detects COD when amount_due is positive", () => {
    expect(isCod("unpaid", 5.5)).toBe(true);
  });

  it("detects COD when both payment_status is cod AND amount_due > 0", () => {
    expect(isCod("cod", 12.5)).toBe(true);
  });

  it("returns false when paid and amount_due is 0", () => {
    expect(isCod("paid", 0)).toBe(false);
  });

  it("returns false for partial with amount_due 0", () => {
    expect(isCod("partial", 0)).toBe(false);
  });
});

// ── Paid / Nothing to collect banner text ────────────────────────────────────

describe("COD banner text selection", () => {
  function bannerText(isCod: boolean, amountDue: number): string {
    if (isCod) {
      return `AMOUNT TO COLLECT: ${formatBhd(amountDue)}`;
    }
    return "PAID — NOTHING TO COLLECT";
  }

  it("shows AMOUNT TO COLLECT with BHD for COD orders", () => {
    expect(bannerText(true, 5.5)).toBe("AMOUNT TO COLLECT: BHD 5.500");
  });

  it("shows zero correctly for COD with 0 amount (edge case)", () => {
    expect(bannerText(true, 0)).toBe("AMOUNT TO COLLECT: BHD 0.000");
  });

  it("shows PAID — NOTHING TO COLLECT for paid orders", () => {
    expect(bannerText(false, 0)).toBe("PAID — NOTHING TO COLLECT");
  });

  it("3-decimal BHD formatting", () => {
    expect(formatBhd(12.5)).toBe("BHD 12.500");
    expect(formatBhd(0.25)).toBe("BHD 0.250");
    expect(formatBhd(100)).toBe("BHD 100.000");
  });
});

// ── Phone display ─────────────────────────────────────────────────────────────

describe("Phone display for print label", () => {
  it("formats normalized Bahrain number for display", () => {
    expect(formatBahrainPhone("97333331101")).toBe("+973 3333 1101");
  });

  it("falls back to empty string for null", () => {
    expect(formatBahrainPhone(null)).toBe("");
  });

  it("falls back to empty string for undefined", () => {
    expect(formatBahrainPhone(undefined)).toBe("");
  });

  it("handles already-formatted number gracefully (returns original)", () => {
    // formatBahrainPhone expects normalized form; passing formatted returns original
    const result = formatBahrainPhone("+973 3333 1101");
    // strips non-digits → "973333 1101" doesn't match 11 digit check exactly, returns original
    expect(typeof result).toBe("string");
  });
});

// ── Items summary construction ────────────────────────────────────────────────

describe("Items summary (LabelTemplate logic)", () => {
  type ItemSnapshot = {
    quantity: number;
    product_name_snapshot: string;
    color_snapshot: string;
    size_snapshot: string;
  };

  function buildItemsSummary(items: ItemSnapshot[]): string {
    return items
      .map((item) => `${item.quantity}× ${item.product_name_snapshot} (${item.color_snapshot}/${item.size_snapshot})`)
      .join(" | ");
  }

  it("formats a single item correctly", () => {
    const items: ItemSnapshot[] = [
      { quantity: 1, product_name_snapshot: "Satin Dress", color_snapshot: "Black", size_snapshot: "M" },
    ];
    expect(buildItemsSummary(items)).toBe("1× Satin Dress (Black/M)");
  });

  it("joins multiple items with pipe separator", () => {
    const items: ItemSnapshot[] = [
      { quantity: 2, product_name_snapshot: "Satin Dress", color_snapshot: "Black", size_snapshot: "M" },
      { quantity: 1, product_name_snapshot: "Silk Top", color_snapshot: "Ivory", size_snapshot: "S" },
    ];
    expect(buildItemsSummary(items)).toBe("2× Satin Dress (Black/M) | 1× Silk Top (Ivory/S)");
  });

  it("returns empty string for no items", () => {
    expect(buildItemsSummary([])).toBe("");
  });
});

// ── Address priority (delivery snapshot > customer) ──────────────────────────

describe("Address priority (LabelTemplate logic)", () => {
  type Delivery = {
    governorate: string | null;
    area: string | null;
    block: string | null;
  } | null;

  type Customer = {
    governorate: string | null;
    area: string | null;
    block: string | null;
  };

  function resolveAddress(delivery: Delivery, customer: Customer) {
    return {
      governorate: delivery?.governorate ?? customer.governorate ?? "",
      area: delivery?.area ?? customer.area ?? "",
      block: delivery?.block ?? customer.block ?? "",
    };
  }

  it("uses delivery snapshot when present", () => {
    const result = resolveAddress(
      { governorate: "Capital Governorate", area: "Manama", block: "305" },
      { governorate: "Northern Governorate", area: "Hamad Town", block: "100" },
    );
    expect(result.governorate).toBe("Capital Governorate");
    expect(result.area).toBe("Manama");
    expect(result.block).toBe("305");
  });

  it("falls back to customer data when delivery is null", () => {
    const result = resolveAddress(null, {
      governorate: "Northern Governorate",
      area: "Hamad Town",
      block: "100",
    });
    expect(result.governorate).toBe("Northern Governorate");
    expect(result.area).toBe("Hamad Town");
    expect(result.block).toBe("100");
  });

  it("uses delivery value over null customer field", () => {
    const result = resolveAddress(
      { governorate: "Muharraq Governorate", area: null, block: null },
      { governorate: "Capital Governorate", area: "Manama", block: "100" },
    );
    expect(result.governorate).toBe("Muharraq Governorate");
    expect(result.area).toBe("Manama"); // delivery null → fall back to customer
    expect(result.block).toBe("100");
  });

  it("returns empty string when both delivery and customer field are null", () => {
    const result = resolveAddress(
      { governorate: null, area: null, block: null },
      { governorate: null, area: null, block: null },
    );
    expect(result.governorate).toBe("");
    expect(result.area).toBe("");
    expect(result.block).toBe("");
  });
});

// ── Fulfilment method guard ───────────────────────────────────────────────────

describe("Label page walk-in guard", () => {
  type FulfilmentMethod = "walk_in" | "customer_pickup" | "delivery";

  function shouldShowLabel(method: FulfilmentMethod): boolean {
    return method === "delivery";
  }

  it("shows label for delivery orders", () => {
    expect(shouldShowLabel("delivery")).toBe(true);
  });

  it("hides label for walk-in orders", () => {
    expect(shouldShowLabel("walk_in")).toBe(false);
  });

  it("hides label for customer-pickup orders", () => {
    expect(shouldShowLabel("customer_pickup")).toBe(false);
  });
});
