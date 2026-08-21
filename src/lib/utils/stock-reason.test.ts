import { describe, expect, it } from "vitest";
import {
  RECEIVE_STOCK_REASONS,
  reasonToMovementType,
  RECEIVE_STOCK_REASON_LABELS,
  STOCK_CORRECTION_REASONS,
  STOCK_CORRECTION_REASON_LABELS,
  buildCorrectionNote,
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

describe("STOCK_CORRECTION_REASON_LABELS", () => {
  it("has a label for every correction reason value", () => {
    for (const reason of Object.values(STOCK_CORRECTION_REASONS)) {
      expect(STOCK_CORRECTION_REASON_LABELS[reason]).toBeTruthy();
    }
  });

  it("stock_count label is human-readable", () => {
    expect(STOCK_CORRECTION_REASON_LABELS["stock_count"]).toBe("Stock count correction");
  });
});

describe("buildCorrectionNote", () => {
  it("uses the reason label alone when no extra note is typed — always non-empty for the 3-char minimum", () => {
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.stockCount, "")).toBe("Stock count correction");
  });

  it("uses the reason label alone when the note is only whitespace", () => {
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.damaged, "   ")).toBe("Damaged / unsellable");
  });

  it("combines the reason label with a trimmed extra note", () => {
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.stockCount, "  recounted after stocktake  ")).toBe(
      "Stock count correction: recounted after stocktake",
    );
  });

  it("produces a distinct, readable string per reason", () => {
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.lostOrStolen, "")).toBe("Lost or stolen");
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.dataEntryError, "")).toBe("Data entry error");
    expect(buildCorrectionNote(STOCK_CORRECTION_REASONS.other, "")).toBe("Other");
  });
});
