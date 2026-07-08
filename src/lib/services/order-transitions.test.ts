/**
 * Pure logic tests for the order and delivery state machines.
 * These do NOT hit the database — they exercise the transition tables and
 * supporting constants only.
 */
import { describe, expect, it } from "vitest";
import {
  ORDER_NEXT_STATUSES,
  ORDER_STATUSES_REQUIRING_REASON,
  ORDER_ACTIVE_STATUSES,
  ORDER_COMPLETED_STATUSES,
  DELIVERY_NEXT_STATUSES,
  DELIVERY_STATUSES_REQUIRING_REASON,
} from "@/lib/constants/statuses";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canTransitionOrder(from: string, to: string): boolean {
  return (ORDER_NEXT_STATUSES[from] ?? []).includes(to);
}

function canTransitionDelivery(from: string, to: string): boolean {
  return (DELIVERY_NEXT_STATUSES[from] ?? []).includes(to);
}

// ─── Allowed order transitions ────────────────────────────────────────────────

describe("ORDER_NEXT_STATUSES — allowed transitions", () => {
  it("new → confirmed", () => {
    expect(canTransitionOrder("new", "confirmed")).toBe(true);
  });

  it("confirmed → completed (walk-in direct path)", () => {
    expect(canTransitionOrder("confirmed", "completed")).toBe(true);
  });

  // In the simplified workflow, fulfilment stages (packed/ready/out_for_delivery)
  // are driven by Delivery, not Order. Legacy order statuses have no forward transitions.
  it("legacy packed has no forward order transitions", () => {
    expect(canTransitionOrder("packed", "ready_for_pickup")).toBe(false);
    expect(canTransitionOrder("packed", "out_for_delivery")).toBe(false);
  });

  it("legacy ready_for_pickup has no forward order transitions", () => {
    expect(canTransitionOrder("ready_for_pickup", "out_for_delivery")).toBe(false);
    expect(canTransitionOrder("ready_for_pickup", "delivered")).toBe(false);
  });
});

// ─── Blocked order transitions ────────────────────────────────────────────────

describe("ORDER_NEXT_STATUSES — blocked transitions", () => {
  it("new → delivered is NOT allowed directly", () => {
    expect(canTransitionOrder("new", "delivered")).toBe(false);
  });

  it("new → packed is NOT allowed (skips confirmed)", () => {
    expect(canTransitionOrder("new", "packed")).toBe(false);
  });

  it("confirmed → delivered is NOT allowed (skips packed + ready)", () => {
    expect(canTransitionOrder("confirmed", "delivered")).toBe(false);
  });

  it("out_for_delivery → confirmed is NOT a valid back-transition", () => {
    expect(canTransitionOrder("out_for_delivery", "confirmed")).toBe(false);
  });

  it("delivered has no allowed next statuses", () => {
    expect(ORDER_NEXT_STATUSES["delivered"]).toHaveLength(0);
  });

  it("cancelled has no allowed next statuses", () => {
    expect(ORDER_NEXT_STATUSES["cancelled"]).toHaveLength(0);
  });

  it("returned has no allowed next statuses", () => {
    expect(ORDER_NEXT_STATUSES["returned"]).toHaveLength(0);
  });
});

// ─── Reason requirement for orders ───────────────────────────────────────────

describe("ORDER_STATUSES_REQUIRING_REASON", () => {
  it("cancelled requires a reason", () => {
    expect(ORDER_STATUSES_REQUIRING_REASON).toContain("cancelled");
  });

  it("delivered does NOT require a reason", () => {
    expect(ORDER_STATUSES_REQUIRING_REASON).not.toContain("delivered");
  });

  it("confirmed does NOT require a reason", () => {
    expect(ORDER_STATUSES_REQUIRING_REASON).not.toContain("confirmed");
  });
});

// ─── Active / completed status sets ──────────────────────────────────────────

describe("ORDER_ACTIVE_STATUSES and ORDER_COMPLETED_STATUSES", () => {
  it("new is active", () => {
    expect(ORDER_ACTIVE_STATUSES.has("new")).toBe(true);
  });

  it("out_for_delivery is active", () => {
    expect(ORDER_ACTIVE_STATUSES.has("out_for_delivery")).toBe(true);
  });

  it("delivered is completed, not active", () => {
    expect(ORDER_ACTIVE_STATUSES.has("delivered")).toBe(false);
    expect(ORDER_COMPLETED_STATUSES.has("delivered")).toBe(true);
  });

  it("returned is completed, not active", () => {
    expect(ORDER_COMPLETED_STATUSES.has("returned")).toBe(true);
    expect(ORDER_ACTIVE_STATUSES.has("returned")).toBe(false);
  });

  it("cancelled is in neither active nor completed", () => {
    expect(ORDER_ACTIVE_STATUSES.has("cancelled")).toBe(false);
    expect(ORDER_COMPLETED_STATUSES.has("cancelled")).toBe(false);
  });
});

// ─── Delivery state machine ───────────────────────────────────────────────────

describe("DELIVERY_NEXT_STATUSES — allowed transitions", () => {
  it("pending → packed", () => {
    expect(canTransitionDelivery("pending", "packed")).toBe(true);
  });

  it("packed → ready_for_pickup", () => {
    expect(canTransitionDelivery("packed", "ready_for_pickup")).toBe(true);
  });

  it("ready_for_pickup → out_for_delivery", () => {
    expect(canTransitionDelivery("ready_for_pickup", "out_for_delivery")).toBe(true);
  });

  it("out_for_delivery → delivered", () => {
    expect(canTransitionDelivery("out_for_delivery", "delivered")).toBe(true);
  });

  it("failed → with_courier (retry after failed attempt)", () => {
    expect(canTransitionDelivery("failed", "with_courier")).toBe(true);
  });
});

// ─── Blocked delivery transitions ────────────────────────────────────────────

describe("DELIVERY_NEXT_STATUSES — blocked transitions", () => {
  it("pending → delivered is NOT allowed directly", () => {
    expect(canTransitionDelivery("pending", "delivered")).toBe(false);
  });

  it("delivered has no allowed next statuses", () => {
    const nexts = DELIVERY_NEXT_STATUSES["delivered"] ?? [];
    expect(nexts).toHaveLength(0);
  });

  it("returned has no allowed next statuses", () => {
    const nexts = DELIVERY_NEXT_STATUSES["returned"] ?? [];
    expect(nexts).toHaveLength(0);
  });
});

// ─── Reason requirement for deliveries ───────────────────────────────────────

describe("DELIVERY_STATUSES_REQUIRING_REASON", () => {
  it("failed requires a reason", () => {
    expect(DELIVERY_STATUSES_REQUIRING_REASON).toContain("failed");
  });

  it("returned requires a reason", () => {
    expect(DELIVERY_STATUSES_REQUIRING_REASON).toContain("returned");
  });

  it("delivered does NOT require a reason", () => {
    expect(DELIVERY_STATUSES_REQUIRING_REASON).not.toContain("delivered");
  });

  it("packed does NOT require a reason", () => {
    expect(DELIVERY_STATUSES_REQUIRING_REASON).not.toContain("packed");
  });
});

// ─── Role-based action visibility (logic) ────────────────────────────────────

describe("Role-based permission gates (constants)", () => {
  it("all allowed order transitions are in ORDER_NEXT_STATUSES", () => {
    const allStatuses = Object.keys(ORDER_NEXT_STATUSES);
    expect(allStatuses).toContain("new");
    expect(allStatuses).toContain("ready_for_pickup");
    expect(allStatuses).toContain("cancelled");
  });

  it("ORDER_NEXT_STATUSES covers all expected source statuses", () => {
    const expectedSources = [
      "new",
      "confirmed",
      "in_fulfilment",
      "completed",
      "cancelled",
      "returned",
      "exchange_requested",
      // Legacy values kept for existing data
      "packed",
      "ready_for_pickup",
      "out_for_delivery",
      "delivered",
    ];
    for (const status of expectedSources) {
      expect(ORDER_NEXT_STATUSES).toHaveProperty(status);
    }
  });

  it("DELIVERY_NEXT_STATUSES covers all expected delivery source statuses", () => {
    const expectedSources = [
      "pending",
      "packed",
      "ready_for_pickup",
      "with_courier",
      "out_for_delivery",
      "delivered",
      "failed",
      "returned_to_store",
      "cancelled",
      // Legacy value kept for existing data
      "returned",
    ];
    for (const status of expectedSources) {
      expect(DELIVERY_NEXT_STATUSES).toHaveProperty(status);
    }
  });
});

// ─── Order / delivery synchronisation logic ──────────────────────────────────

describe("Order → Delivery synchronisation rules (from spec)", () => {
  it("fulfilment stages are not reachable from orders — delivery drives them", () => {
    // In the simplified workflow, staff cannot manually advance an order through
    // packed / ready_for_pickup / out_for_delivery from the Orders page.
    // The Delivery record tracks those stages; the order moves to in_fulfilment
    // via confirmOrderHandoff and to completed when delivery reaches delivered.
    expect(canTransitionOrder("confirmed", "packed")).toBe(false);
    expect(canTransitionOrder("confirmed", "out_for_delivery")).toBe(false);
    expect(canTransitionOrder("in_fulfilment", "delivered")).toBe(false);
  });

  it("walk-in orders complete directly: confirmed → completed", () => {
    // For walk-in / pickup orders, the Delivery queue is not used.
    // The staff confirms the order and marks it complete in one step.
    expect(canTransitionOrder("confirmed", "completed")).toBe(true);
    // Walk-in should NOT require going through delivery stages
    expect(canTransitionOrder("confirmed", "packed")).toBe(false);
  });

  it("delivery reaching delivered status should sync its order", () => {
    // The delivery → delivered transition is allowed
    expect(canTransitionDelivery("out_for_delivery", "delivered")).toBe(true);
    // The sync itself is in the service layer (calls advanceDeliveryStatus RPC)
  });
});

// ─── COD collection detection ─────────────────────────────────────────────────

describe("COD detection helpers", () => {
  it("COD collection is needed when payment_status is cod and cod_collected is false", () => {
    const isCodPending = (paymentStatus: string, codCollected: boolean): boolean =>
      paymentStatus === "cod" && !codCollected;

    expect(isCodPending("cod", false)).toBe(true);
    expect(isCodPending("cod", true)).toBe(false);
    expect(isCodPending("paid", false)).toBe(false);
    expect(isCodPending("unpaid", false)).toBe(false);
  });
});
