/**
 * Structural regression guard for CancelDuplicateDialog — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase). Covers the "Cancel /
 * Mark duplicate" cleanup flow for wrong orders (e.g. MSV-10010/MSV-10011 replaced by a
 * size/color correction).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "cancel-duplicate-dialog.tsx"), "utf-8");

describe("CancelDuplicateDialog — required fields", () => {
  it("requires a reason", () => {
    expect(source).toContain("Reason");
    expect(source).toMatch(/reason\.trim\(\)\.length < 3/);
  });

  it("shows the suggested reason wording from the spec as a placeholder", () => {
    expect(source).toContain("Customer changed size; correct order created as MSV-10012.");
  });

  it("accepts an optional linked correct order number", () => {
    expect(source).toContain("Correct order number (optional)");
  });

  it("lets staff choose whether to return items to stock", () => {
    expect(source).toContain("Return items to stock");
    expect(source).toContain("returnStock");
  });
});

describe("CancelDuplicateDialog — never deletes, only cancels", () => {
  it("tells staff the order stays in history and is never deleted", () => {
    expect(source).toMatch(/never deleted/i);
  });

  it("calls the reason-aware cancel action, not the quick one-click cancelOrderAction", () => {
    expect(source).toContain("cancelOrderWithReasonAction");
    expect(source).not.toContain("cancelOrderAction(");
  });
});

describe("CancelDuplicateDialog — friendly error on failure", () => {
  it("shows a friendly error and logs the real error server-side", () => {
    expect(source).toContain("Could not cancel this order. Please try again or contact the administrator.");
    expect(source).toMatch(/console\.error\(/);
  });
});
