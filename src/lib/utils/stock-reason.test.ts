import { describe, expect, it } from "vitest";
import {
  RECEIVE_STOCK_REASONS,
  reasonToMovementType,
  RECEIVE_STOCK_REASON_LABELS,
} from "./stock-reason";

describe("reasonToMovementType", () => {
  it("maps supplier_delivery to purchase_stock", () => {
    expect(reasonToMovementType(RECEIVE_STOCK_REASONS.supplierDelivery)).toBe("purchase_stock");
  });

  it("maps opening_stock to opening_stock", () => {
    expect(reasonToMovementType(RECEIVE_STOCK_REASONS.openingStock)).toBe("opening_stock");
  });

  it("maps customer_return to return_added", () => {
    expect(reasonToMovementType(RECEIVE_STOCK_REASONS.customerReturn)).toBe("return_added");
  });

  it("maps other to opening_stock (safe fallback)", () => {
    expect(reasonToMovementType(RECEIVE_STOCK_REASONS.other)).toBe("opening_stock");
  });
});

describe("RECEIVE_STOCK_REASON_LABELS", () => {
  it("has a label for every reason value", () => {
    const reasonValues = Object.values(RECEIVE_STOCK_REASONS);
    for (const reason of reasonValues) {
      expect(RECEIVE_STOCK_REASON_LABELS[reason]).toBeTruthy();
    }
  });

  it("supplier_delivery label is human-readable", () => {
    expect(RECEIVE_STOCK_REASON_LABELS["supplier_delivery"]).toBe("New supplier delivery");
  });

  it("customer_return label is human-readable", () => {
    expect(RECEIVE_STOCK_REASON_LABELS["customer_return"]).toBe("Customer return");
  });
});
