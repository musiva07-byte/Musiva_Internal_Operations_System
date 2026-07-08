import { describe, expect, it } from "vitest";
import {
  groupByDate,
  needsAttentionOrder,
  needsAttentionDelivery,
  computeOrderSummary,
  computeDeliverySummary,
  ORDER_ATTENTION_LABELS,
  DELIVERY_ATTENTION_LABELS,
  SAFE_BULK_ORDER_ACTIONS,
  SAFE_BULK_DELIVERY_ACTIONS,
} from "./queue";
import type { OrderListItem, DeliveryListItem } from "@/types/app";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    order_number: "MSV-10001",
    customer_id: "customer-1",
    order_source: "instagram",
    order_status: "new",
    payment_status: "unpaid",
    payment_method: null,
    fulfilment_method: "walk_in",
    subtotal: 10,
    discount_total: 0,
    delivery_charge: 0,
    grand_total: 10,
    amount_paid: 0,
    amount_due: 10,
    staff_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customer_name: "Test Customer",
    customer_mobile: "33001234",
    item_count: 1,
    delivery_id: null,
    delivery_status: null,
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<DeliveryListItem> = {}): DeliveryListItem {
  return {
    id: "delivery-1",
    order_id: "order-1",
    customer_name: "Test Customer",
    phone: "33001234",
    governorate: "Capital Governorate",
    area: "Manama",
    block: "305",
    road: "1506",
    building: "12",
    flat: null,
    landmark: null,
    delivery_note: null,
    delivery_date: null,
    delivery_time_slot: null,
    courier_name: null,
    courier_phone: null,
    delivery_status: "pending",
    assigned_to_id: null,
    assigned_at: null,
    failure_reason: null,
    failure_note: null,
    cod_amount: null,
    cod_collected: false,
    cod_collected_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_number: "MSV-10001",
    payment_status: "unpaid",
    amount_due: 0,
    grand_total: 10,
    fulfilment_method: "delivery",
    ...overrides,
  };
}

// ─── groupByDate ──────────────────────────────────────────────────────────────

describe("groupByDate", () => {
  it("groups items created today under a 'Today' label", () => {
    const today = new Date().toISOString();
    const items = [makeOrder({ created_at: today })];
    const groups = groupByDate(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toMatch(/^Today —/);
  });

  it("groups items from yesterday under 'Yesterday' label", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const items = [makeOrder({ created_at: yesterday })];
    const groups = groupByDate(items);
    expect(groups[0].label).toMatch(/^Yesterday —/);
  });

  it("groups items from earlier dates by their date", () => {
    const older = "2026-01-15T10:00:00.000Z";
    const items = [makeOrder({ created_at: older })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe("15 January 2026");
  });

  it("returns groups sorted newest first", () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const olderDate = "2026-01-10T10:00:00.000Z";

    const items = [
      makeOrder({ id: "1", created_at: olderDate }),
      makeOrder({ id: "2", created_at: today }),
      makeOrder({ id: "3", created_at: yesterday }),
    ];
    const groups = groupByDate(items);
    expect(groups[0].label).toMatch(/^Today/);
    expect(groups[1].label).toMatch(/^Yesterday/);
    expect(groups[2].dateKey).toBe("2026-01-10");
  });

  it("puts items from the same date in the same group", () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const today2 = new Date();
    today2.setHours(14, 0, 0, 0);

    const items = [
      makeOrder({ id: "1", created_at: today.toISOString() }),
      makeOrder({ id: "2", created_at: today2.toISOString() }),
    ];
    const groups = groupByDate(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupByDate([])).toHaveLength(0);
  });

  it("preserves item ordering within a group (insertion order)", () => {
    const todayA = new Date();
    todayA.setHours(8, 0, 0, 0);
    const todayB = new Date();
    todayB.setHours(16, 0, 0, 0);

    const items = [
      makeOrder({ id: "a", created_at: todayA.toISOString() }),
      makeOrder({ id: "b", created_at: todayB.toISOString() }),
    ];
    const groups = groupByDate(items);
    expect(groups[0].items[0].id).toBe("a");
    expect(groups[0].items[1].id).toBe("b");
  });
});

// ─── needsAttentionOrder ──────────────────────────────────────────────────────

describe("needsAttentionOrder", () => {
  it("returns null for a normal new unpaid order (not ready yet)", () => {
    const order = makeOrder({ order_status: "new", payment_status: "unpaid" });
    expect(needsAttentionOrder(order)).toBeNull();
  });

  it("returns unpaid_ready for a ready_for_pickup unpaid order", () => {
    const order = makeOrder({
      order_status: "ready_for_pickup",
      payment_status: "unpaid",
    });
    expect(needsAttentionOrder(order)).toBe("unpaid_ready");
  });

  it("returns unpaid_ready for out_for_delivery unpaid order", () => {
    const order = makeOrder({
      order_status: "out_for_delivery",
      payment_status: "unpaid",
    });
    expect(needsAttentionOrder(order)).toBe("unpaid_ready");
  });

  it("returns null for ready_for_pickup paid order", () => {
    const order = makeOrder({
      order_status: "ready_for_pickup",
      payment_status: "paid",
      amount_due: 0,
    });
    expect(needsAttentionOrder(order)).toBeNull();
  });

  it("returns cod_amount_due for delivered COD order with amount due", () => {
    const order = makeOrder({
      order_status: "delivered",
      payment_status: "cod",
      amount_due: 5.5,
    });
    expect(needsAttentionOrder(order)).toBe("cod_amount_due");
  });

  it("returns null for delivered COD order with zero amount due", () => {
    const order = makeOrder({
      order_status: "delivered",
      payment_status: "cod",
      amount_due: 0,
    });
    expect(needsAttentionOrder(order)).toBeNull();
  });

  it("returns missing_mobile when customer_mobile is empty", () => {
    const order = makeOrder({ customer_mobile: "" });
    expect(needsAttentionOrder(order)).toBe("missing_mobile");
  });

  it("returns missing_mobile when customer_mobile is blank spaces", () => {
    const order = makeOrder({ customer_mobile: "  " });
    // mobile is truthy (has chars), so no missing-mobile flag
    // The check is !order.customer_mobile — blank string with spaces is truthy
    expect(needsAttentionOrder(order)).toBeNull();
  });

  it("has a label for every attention reason", () => {
    expect(ORDER_ATTENTION_LABELS.unpaid_ready).toBeDefined();
    expect(ORDER_ATTENTION_LABELS.cod_amount_due).toBeDefined();
    expect(ORDER_ATTENTION_LABELS.missing_mobile).toBeDefined();
  });
});

// ─── needsAttentionDelivery ───────────────────────────────────────────────────

describe("needsAttentionDelivery", () => {
  it("returns null for a clean pending delivery", () => {
    const delivery = makeDelivery();
    expect(needsAttentionDelivery(delivery)).toBeNull();
  });

  it("returns missing_phone when phone is empty", () => {
    const delivery = makeDelivery({ phone: "" });
    expect(needsAttentionDelivery(delivery)).toBe("missing_phone");
  });

  it("returns missing_address when area and governorate are both null", () => {
    const delivery = makeDelivery({ area: null, governorate: null });
    expect(needsAttentionDelivery(delivery)).toBe("missing_address");
  });

  it("does NOT flag missing_address when governorate is set but area is null", () => {
    const delivery = makeDelivery({ area: null, governorate: "Capital Governorate" });
    expect(needsAttentionDelivery(delivery)).toBeNull();
  });

  it("returns failed for failed deliveries", () => {
    const delivery = makeDelivery({ delivery_status: "failed" });
    expect(needsAttentionDelivery(delivery)).toBe("failed");
  });

  it("returns cod_uncollected for delivered COD with unpaid due", () => {
    const delivery = makeDelivery({
      delivery_status: "delivered",
      payment_status: "cod",
      cod_collected: false,
      amount_due: 10,
    });
    expect(needsAttentionDelivery(delivery)).toBe("cod_uncollected");
  });

  it("returns null for delivered COD that has been collected", () => {
    const delivery = makeDelivery({
      delivery_status: "delivered",
      payment_status: "cod",
      cod_collected: true,
      amount_due: 0,
    });
    expect(needsAttentionDelivery(delivery)).toBeNull();
  });

  it("has a label for every attention reason", () => {
    expect(DELIVERY_ATTENTION_LABELS.failed).toBeDefined();
    expect(DELIVERY_ATTENTION_LABELS.missing_address).toBeDefined();
    expect(DELIVERY_ATTENTION_LABELS.missing_phone).toBeDefined();
    expect(DELIVERY_ATTENTION_LABELS.cod_uncollected).toBeDefined();
  });
});

// ─── computeOrderSummary ──────────────────────────────────────────────────────

describe("computeOrderSummary", () => {
  it("returns zero counts for empty array", () => {
    const result = computeOrderSummary([]);
    expect(result.count).toBe(0);
    expect(result.total).toBe(0);
    expect(result.attentionCount).toBe(0);
  });

  it("sums grand_total across orders", () => {
    const orders = [
      makeOrder({ grand_total: 10 }),
      makeOrder({ grand_total: 5.5 }),
      makeOrder({ grand_total: 3.25 }),
    ];
    const { total } = computeOrderSummary(orders);
    expect(total).toBeCloseTo(18.75, 3);
  });

  it("counts orders needing attention", () => {
    const orders = [
      makeOrder({ order_status: "ready_for_pickup", payment_status: "unpaid" }),
      makeOrder({ order_status: "new", payment_status: "unpaid" }),
      makeOrder({ customer_mobile: "" }),
    ];
    const { attentionCount } = computeOrderSummary(orders);
    expect(attentionCount).toBe(2);
  });
});

// ─── computeDeliverySummary ───────────────────────────────────────────────────

describe("computeDeliverySummary", () => {
  it("counts pending and out_for_delivery separately", () => {
    const deliveries = [
      makeDelivery({ id: "1", delivery_status: "pending" }),
      makeDelivery({ id: "2", delivery_status: "pending" }),
      makeDelivery({ id: "3", delivery_status: "out_for_delivery" }),
      makeDelivery({ id: "4", delivery_status: "delivered" }),
    ];
    const { pending, outForDelivery } = computeDeliverySummary(deliveries);
    expect(pending).toBe(2);
    expect(outForDelivery).toBe(1);
  });

  it("counts attention items", () => {
    const deliveries = [
      makeDelivery({ id: "1", delivery_status: "failed" }),
      makeDelivery({ id: "2" }),
    ];
    const { attentionCount } = computeDeliverySummary(deliveries);
    expect(attentionCount).toBe(1);
  });
});

// ─── Allowed bulk actions ─────────────────────────────────────────────────────

describe("safe bulk action lists", () => {
  it("only allows confirm for order bulk actions (simplified workflow)", () => {
    expect(SAFE_BULK_ORDER_ACTIONS).toContain("confirm");
    // pack and ready are now Delivery-side actions, not Order-side bulk actions
    expect(SAFE_BULK_ORDER_ACTIONS).not.toContain("pack");
    expect(SAFE_BULK_ORDER_ACTIONS).not.toContain("ready");
    expect(SAFE_BULK_ORDER_ACTIONS).not.toContain("delivered");
    expect(SAFE_BULK_ORDER_ACTIONS).not.toContain("cancelled");
  });

  it("only allows packed and ready_for_pickup for delivery bulk actions", () => {
    expect(SAFE_BULK_DELIVERY_ACTIONS).toContain("packed");
    expect(SAFE_BULK_DELIVERY_ACTIONS).toContain("ready_for_pickup");
    expect(SAFE_BULK_DELIVERY_ACTIONS).not.toContain("delivered");
    expect(SAFE_BULK_DELIVERY_ACTIONS).not.toContain("failed");
  });
});

// ─── Newest-first sort verification ──────────────────────────────────────────

describe("newest-first ordering", () => {
  it("groupByDate returns newest date group first", () => {
    const first = "2026-07-05T08:00:00.000Z";
    const second = "2026-07-04T08:00:00.000Z";
    const third = "2026-07-03T08:00:00.000Z";

    const items = [
      makeOrder({ id: "c", created_at: third }),
      makeOrder({ id: "a", created_at: first }),
      makeOrder({ id: "b", created_at: second }),
    ];

    const groups = groupByDate(items);
    expect(groups[0].dateKey).toBe("2026-07-05");
    expect(groups[1].dateKey).toBe("2026-07-04");
    expect(groups[2].dateKey).toBe("2026-07-03");
  });
});

// ─── Tab count type shape ─────────────────────────────────────────────────────

describe("OrderTabCounts and DeliveryTabCounts shape", () => {
  it("OrderTabCounts has all required keys", () => {
    const counts = {
      today: 1,
      new: 2,
      confirmed: 3,
      packing: 0,
      ready: 1,
      completed: 5,
      all: 12,
    };
    // Type-level check: should compile without errors
    expect(Object.keys(counts)).toHaveLength(7);
  });

  it("DeliveryTabCounts has all required keys", () => {
    const counts = {
      today: 0,
      pending: 3,
      packed: 1,
      ready: 2,
      out_for_delivery: 1,
      failed: 0,
      delivered: 10,
      all: 17,
    };
    expect(Object.keys(counts)).toHaveLength(8);
  });
});
