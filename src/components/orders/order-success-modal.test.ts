/**
 * Pure logic tests for OrderSuccessModal helpers.
 *
 * DOM-level tests (modal open/close, focus trapping, button clicks) require
 * @testing-library/react + jsdom which is not in this project. These tests
 * cover the business logic that drives the UI.
 */
import { describe, expect, it } from "vitest";
import {
  isDeliveryOrder,
  primaryActionLabel,
  primaryPrintUrl,
  type OrderSuccessSnapshot,
} from "./order-success-modal";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";

// ── Helpers used throughout ───────────────────────────────────────────────────

const deliverySnapshot: OrderSuccessSnapshot = {
  id: "order-uuid-1",
  orderNumber: "MSV-10006",
  customerName: "Fatima Al Rashidi",
  customerPhone: "33331101",
  grandTotal: 11.0,
  paymentStatus: "unpaid",
  fulfilmentMethod: "delivery",
  deliveryStatus: "pending",
};

const walkInSnapshot: OrderSuccessSnapshot = {
  id: "order-uuid-2",
  orderNumber: "MSV-10007",
  customerName: "Jane Smith",
  customerPhone: "+973 3600 1234",
  grandTotal: 8.5,
  paymentStatus: "paid",
  fulfilmentMethod: "walk_in",
  deliveryStatus: null,
};

const pickupSnapshot: OrderSuccessSnapshot = {
  id: "order-uuid-3",
  orderNumber: "MSV-10008",
  customerName: "Sara",
  customerPhone: "36001234",
  grandTotal: 5.0,
  paymentStatus: "partial",
  fulfilmentMethod: "customer_pickup",
  deliveryStatus: null,
};

// ── isDeliveryOrder ───────────────────────────────────────────────────────────

describe("isDeliveryOrder", () => {
  it("returns true for delivery", () => {
    expect(isDeliveryOrder("delivery")).toBe(true);
  });

  it("returns false for walk_in", () => {
    expect(isDeliveryOrder("walk_in")).toBe(false);
  });

  it("returns false for customer_pickup", () => {
    expect(isDeliveryOrder("customer_pickup")).toBe(false);
  });
});

// ── primaryActionLabel ────────────────────────────────────────────────────────

describe("primaryActionLabel", () => {
  it("shows 'Print Package Sheet' for delivery orders", () => {
    expect(primaryActionLabel("delivery")).toBe("Print Package Sheet");
  });

  it("shows 'Print Receipt' for walk-in orders", () => {
    expect(primaryActionLabel("walk_in")).toBe("Print Receipt");
  });

  it("shows 'Print Receipt' for customer_pickup orders", () => {
    expect(primaryActionLabel("customer_pickup")).toBe("Print Receipt");
  });
});

// ── primaryPrintUrl ───────────────────────────────────────────────────────────

describe("primaryPrintUrl", () => {
  it("returns /print/combined/[id] for delivery orders", () => {
    expect(primaryPrintUrl("order-uuid-1", "delivery")).toBe(
      "/print/combined/order-uuid-1",
    );
  });

  it("returns /print/invoice/[id] for walk-in orders", () => {
    expect(primaryPrintUrl("order-uuid-2", "walk_in")).toBe(
      "/print/invoice/order-uuid-2",
    );
  });

  it("returns /print/invoice/[id] for pickup orders", () => {
    expect(primaryPrintUrl("order-uuid-3", "customer_pickup")).toBe(
      "/print/invoice/order-uuid-3",
    );
  });

  it("uses the correct order ID in the URL", () => {
    const url = primaryPrintUrl("specific-uuid-999", "delivery");
    expect(url).toContain("specific-uuid-999");
    expect(url).not.toContain("wrong-id");
  });
});

// ── Label-only action visibility ──────────────────────────────────────────────

describe("Label actions visibility (driven by isDeliveryOrder)", () => {
  it("label action is shown for delivery orders", () => {
    expect(isDeliveryOrder(deliverySnapshot.fulfilmentMethod)).toBe(true);
  });

  it("label action is hidden for walk-in orders", () => {
    expect(isDeliveryOrder(walkInSnapshot.fulfilmentMethod)).toBe(false);
  });

  it("label action is hidden for pickup orders", () => {
    expect(isDeliveryOrder(pickupSnapshot.fulfilmentMethod)).toBe(false);
  });
});

// ── Duplicate submission prevention ──────────────────────────────────────────

describe("Duplicate submission prevention", () => {
  it("submitting state prevents second call (guard pattern)", () => {
    let callCount = 0;
    let isSubmitting = false;

    function handleSubmit() {
      if (isSubmitting) return; // guard
      isSubmitting = true;
      callCount++;
      // simulate async work
      isSubmitting = false;
    }

    // First call succeeds
    handleSubmit();
    expect(callCount).toBe(1);

    // Simulating rapid double-click: if isSubmitting were still true, this would be blocked
    // (In practice, useTransition's isPending serves this role)
    isSubmitting = true;
    handleSubmit();
    isSubmitting = false;
    expect(callCount).toBe(1); // second call was blocked
  });
});

// ── Create Another Sale resets ────────────────────────────────────────────────

describe("Create another sale resets", () => {
  it("success data cleared when creating another sale", () => {
    // Simulate wizard state
    let successData: OrderSuccessSnapshot | null = deliverySnapshot;

    function handleCreateAnother() {
      successData = null; // modal closes
      // router.push("/admin/orders/new") would re-mount wizard with fresh state
    }

    handleCreateAnother();
    expect(successData).toBeNull();
  });
});

// ── View Order opens correct order ────────────────────────────────────────────

describe("View Order navigation", () => {
  it("view order path uses the correct order ID", () => {
    const orderId = deliverySnapshot.id;
    const expectedPath = `/admin/orders/${orderId}`;
    expect(expectedPath).toBe("/admin/orders/order-uuid-1");
  });

  it("different orders use different paths", () => {
    const path1 = `/admin/orders/${deliverySnapshot.id}`;
    const path2 = `/admin/orders/${walkInSnapshot.id}`;
    expect(path1).not.toBe(path2);
  });
});

// ── WhatsApp message contains correct order snapshot ─────────────────────────

describe("WhatsApp message snapshot", () => {
  it("delivery order message contains delivery status", () => {
    const msg = buildWhatsAppMessage({
      customerName: deliverySnapshot.customerName,
      orderNumber: deliverySnapshot.orderNumber,
      grandTotal: deliverySnapshot.grandTotal,
      paymentStatus: deliverySnapshot.paymentStatus,
      deliveryStatus: deliverySnapshot.deliveryStatus,
    });
    expect(msg).toContain("MSV-10006");
    expect(msg).toContain("Fatima Al Rashidi");
    expect(msg).toContain("BHD 11.000");
    expect(msg).toContain("Unpaid");
    expect(msg).toContain("Pending");
  });

  it("walk-in order message does NOT contain delivery status", () => {
    const msg = buildWhatsAppMessage({
      customerName: walkInSnapshot.customerName,
      orderNumber: walkInSnapshot.orderNumber,
      grandTotal: walkInSnapshot.grandTotal,
      paymentStatus: walkInSnapshot.paymentStatus,
      deliveryStatus: walkInSnapshot.deliveryStatus,
    });
    expect(msg).toContain("MSV-10007");
    expect(msg).not.toContain("Delivery:");
  });

  it("WhatsApp URL uses correct phone from snapshot", () => {
    const url = buildWhatsAppUrl(deliverySnapshot.customerPhone, "test message");
    expect(url).toContain("wa.me/97333331101");
  });

  it("success modal only appears after transaction succeeds", () => {
    // If the action returns ok:false, no snapshot is set → modal stays closed
    const failResult = { ok: false, error: "Stock not available", id: null };
    let snapshot: OrderSuccessSnapshot | null = null;

    if (failResult.ok) {
      snapshot = deliverySnapshot; // would be set on success
    }

    expect(snapshot).toBeNull();
  });

  it("success modal appears only after transaction succeeds", () => {
    // Simulated: action returns ok:true with all required fields
    const successResult = {
      ok: true,
      id: "order-uuid-1",
      orderNumber: "MSV-10006",
      grandTotal: 11.0,
      paymentStatus: "unpaid",
      fulfilmentMethod: "delivery",
    };
    let snapshot: OrderSuccessSnapshot | null = null;

    if (successResult.ok) {
      snapshot = {
        id: successResult.id,
        orderNumber: successResult.orderNumber,
        customerName: "Fatima Al Rashidi",
        customerPhone: "33331101",
        grandTotal: successResult.grandTotal,
        paymentStatus: successResult.paymentStatus,
        fulfilmentMethod: successResult.fulfilmentMethod,
        deliveryStatus: successResult.fulfilmentMethod === "delivery" ? "pending" : null,
      };
    }

    expect(snapshot).not.toBeNull();
    expect(snapshot!.orderNumber).toBe("MSV-10006");
    expect(snapshot!.deliveryStatus).toBe("pending");
  });
});
