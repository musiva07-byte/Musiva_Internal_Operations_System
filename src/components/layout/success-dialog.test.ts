/**
 * Structural guard for SuccessDialog — the reusable success confirmation popup factored out of
 * ProductSaveSuccessDialog's pattern for Receive Stock, Correct Quantity, and Order status
 * update, which previously redirected silently with no feedback. Same source-text-guard pattern
 * as breadcrumb.test.ts / back-link.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "success-dialog.tsx"), "utf-8");

describe("SuccessDialog", () => {
  it("is a controlled Dialog with a checkmark title and optional stat list", () => {
    expect(source).toContain("CheckCircle2");
    expect(source).toContain("open: boolean");
    expect(source).toContain("onOpenChange: (open: boolean) => void");
    expect(source).toContain("stats?: SuccessStat[]");
  });
  it("requires a footer of contextual next-step buttons", () => {
    expect(source).toContain("footer: ReactNode");
  });
});

describe("SuccessDialog usage — wired into previously-silent redirects", () => {
  const usages: [string, string, string[]][] = [
    [
      join(__dirname, "..", "inventory", "receive-stock-form.tsx"),
      "Receive Stock",
      ["Stock added successfully", "Add more stock", "View Stock History", "Back to Stock Management"],
    ],
    [
      join(__dirname, "..", "inventory", "stock-adjustment-form.tsx"),
      "Correct Quantity",
      ["Quantity corrected", "Correct another", "View Stock History", "Back to Stock Management"],
    ],
    [
      join(__dirname, "..", "orders", "order-edit-form.tsx"),
      "Order status/payment edit",
      ["Order updated successfully", "Back to Orders", "View order"],
    ],
  ];

  for (const [path, label, expectedStrings] of usages) {
    it(`${label} shows a SuccessDialog with the expected copy and next-step buttons`, () => {
      const fileSource = readFileSync(path, "utf-8");
      expect(fileSource).toContain("SuccessDialog");
      for (const expected of expectedStrings) {
        expect(fileSource).toContain(expected);
      }
    });
  }
});
