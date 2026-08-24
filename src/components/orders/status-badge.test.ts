/**
 * Tests for the staff-facing order status label/helper-text mapping (status-badge.tsx). This
 * is the single place that decides what staff see for each order_status — display only, the
 * underlying OrderStatus enum/DB values are never touched (see order-transitions.test.ts for
 * proof the internal transition logic still uses the raw "in_fulfilment" value).
 */
import { describe, it, expect } from "vitest";
import { orderStatusLabel, orderStatusHelperText } from "./status-badge";

describe("orderStatusLabel — staff-facing labels", () => {
  it('displays "in_fulfilment" as "Preparing"', () => {
    expect(orderStatusLabel("in_fulfilment")).toBe("Preparing");
  });

  it("never displays the raw internal wording again", () => {
    expect(orderStatusLabel("in_fulfilment")).not.toBe("In Fulfilment");
  });

  it("keeps the other simple statuses as titleized labels", () => {
    expect(orderStatusLabel("new")).toBe("New");
    expect(orderStatusLabel("confirmed")).toBe("Confirmed");
    expect(orderStatusLabel("completed")).toBe("Completed");
    expect(orderStatusLabel("cancelled")).toBe("Cancelled");
    expect(orderStatusLabel("returned")).toBe("Returned");
  });
});

describe("orderStatusHelperText — short status hints", () => {
  it("matches the required helper text for each status", () => {
    expect(orderStatusHelperText("new")).toBe("Waiting for confirmation");
    expect(orderStatusHelperText("confirmed")).toBe("Confirmed and ready to prepare");
    expect(orderStatusHelperText("in_fulfilment")).toBe("Being packed, picked up, or delivered");
    expect(orderStatusHelperText("completed")).toBe("Finished order");
    expect(orderStatusHelperText("cancelled")).toBe("Cancelled order");
  });

  it("keeps helper text short (a hint, not a paragraph)", () => {
    const statuses = ["new", "confirmed", "in_fulfilment", "completed", "cancelled", "returned"] as const;
    for (const status of statuses) {
      const text = orderStatusHelperText(status);
      expect(text).not.toBeNull();
      expect((text ?? "").length).toBeLessThan(60);
    }
  });

  it("returns null for a status with no defined helper text", () => {
    expect(orderStatusHelperText("exchange_requested")).toBeNull();
  });
});
