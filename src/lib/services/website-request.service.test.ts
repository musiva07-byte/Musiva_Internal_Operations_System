/**
 * Tests for website-request.service.ts
 *
 * Covers: list/tab-count queries, search, get-by-id, status-transition validation,
 * role-based permission enforcement per transition, and the "never touches stock/order
 * tables" guarantee (website requests never deduct stock or create a final order).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockFrom, mockCreateClient, mockRequireStaffPermission } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

const mockCreateAuditLog = vi.hoisted(() => vi.fn());
vi.mock("./audit.service", () => ({
  createAuditLog: mockCreateAuditLog,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getAllowedNextStatuses,
  getWebsiteRequest,
  listWebsiteRequestTabCounts,
  listWebsiteRequests,
  updateWebsiteRequestStatus,
} from "./website-request.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fluent Supabase query stub that resolves to `result` when awaited, chaining freely. */
function chainResolveAll(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
      },
    },
  );
  return proxy;
}

const baseRequest = {
  id: "req-1",
  request_number: "MWR-20260716-0001",
  product_id: "product-1",
  product_variant_id: "variant-1",
  product_name_snapshot: "A line top",
  color_snapshot: "black",
  size_snapshot: "xl",
  quantity: 1,
  unit_price_snapshot: 11,
  total_snapshot: 11,
  customer_name: "Fatima Ali",
  mobile_display: "33331101",
  mobile_normalized: "+97333331101",
  whatsapp_display: "33331101",
  whatsapp_normalized: "+97333331101",
  governorate: "Capital Governorate",
  area: "Manama",
  block: null,
  road: null,
  building: null,
  flat: null,
  landmark: null,
  delivery_notes: null,
  payment_preference: "cash_on_delivery",
  status: "new",
  whatsapp_message: "Hello Moosiva...",
  created_at: "2026-07-16T22:13:31.489157+00:00",
  updated_at: "2026-07-16T22:13:31.489157+00:00",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom });
  mockFrom.mockReturnValue(chainResolveAll({ data: [], count: 0, error: null }));
});

// ── listWebsiteRequests ────────────────────────────────────────────────────────

describe("listWebsiteRequests", () => {
  it("returns rows and pagination info on success", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: [baseRequest], count: 1, error: null }));

    const result = await listWebsiteRequests({ tab: "new", page: 1 });

    expect(result.data).toEqual([baseRequest]);
    expect(result.count).toBe(1);
    expect(result.page).toBe(1);
    expect(result.loadError).toBeUndefined();
  });

  it("returns a friendly loadError, never a raw Supabase error, on query failure", async () => {
    mockFrom.mockReturnValue(
      chainResolveAll({ data: null, count: null, error: { message: "relation does not exist" } }),
    );

    const result = await listWebsiteRequests({});

    expect(result.data).toEqual([]);
    expect(result.loadError).toBe(
      "Unable to load website requests. Please try again or contact the administrator.",
    );
    expect(result.loadError).not.toContain("relation");
  });

  it("returns an empty, error-free result when Supabase is not configured", async () => {
    mockCreateClient.mockResolvedValue(null);

    const result = await listWebsiteRequests({});

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.loadError).toBeUndefined();
  });

  it("only ever queries website_order_requests — never stock/order tables", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: [], count: 0, error: null }));

    await listWebsiteRequests({ q: "Fatima" });

    for (const call of mockFrom.mock.calls) {
      expect(call[0]).toBe("website_order_requests");
    }
    const queriedTables = mockFrom.mock.calls.map((call) => call[0]);
    for (const forbidden of ["stock_movements", "orders", "order_items", "product_variants", "products"]) {
      expect(queriedTables).not.toContain(forbidden);
    }
  });
});

// ── listWebsiteRequestTabCounts ─────────────────────────────────────────────────

describe("listWebsiteRequestTabCounts", () => {
  it("returns zero counts when Supabase is not configured", async () => {
    mockCreateClient.mockResolvedValue(null);

    const result = await listWebsiteRequestTabCounts();

    expect(result).toEqual({ new: 0, contacted: 0, confirmed: 0, cancelled: 0, all: 0 });
  });

  it("aggregates per-status counts", async () => {
    let call = 0;
    const counts = [3, 1, 2, 0, 6]; // new, contacted, confirmed, cancelled, all
    mockFrom.mockImplementation(() => chainResolveAll({ count: counts[call++], error: null }));

    const result = await listWebsiteRequestTabCounts();

    expect(result).toEqual({ new: 3, contacted: 1, confirmed: 2, cancelled: 0, all: 6 });
  });
});

// ── getWebsiteRequest ────────────────────────────────────────────────────────────

describe("getWebsiteRequest", () => {
  it("returns the row when found", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: baseRequest, error: null }));

    const result = await getWebsiteRequest("req-1");

    expect(result).toEqual(baseRequest);
  });

  it("returns null when not found", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: null, error: null }));

    const result = await getWebsiteRequest("does-not-exist");

    expect(result).toBeNull();
  });

  it("never exposes cost, profit, sku, or barcode fields", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: baseRequest, error: null }));

    const result = await getWebsiteRequest("req-1");
    const serialized = JSON.stringify(result).toLowerCase();

    for (const forbidden of ["cost_price", "landed_cost", "profit", "margin", "supplier", "barcode", "sku"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

// ── getAllowedNextStatuses (pure, role-aware) ───────────────────────────────────

describe("getAllowedNextStatuses", () => {
  it("sales_staff can mark a new request as contacted only", () => {
    expect(getAllowedNextStatuses("new", "sales_staff")).toEqual(["contacted"]);
  });

  it("inventory_staff can mark a new request as contacted only", () => {
    expect(getAllowedNextStatuses("new", "inventory_staff")).toEqual(["contacted"]);
  });

  it("manager can confirm or cancel a new request, in addition to contacted", () => {
    expect(getAllowedNextStatuses("new", "manager")).toEqual(["contacted", "confirmed", "cancelled"]);
  });

  it("owner can confirm or cancel a contacted request", () => {
    expect(getAllowedNextStatuses("contacted", "owner")).toEqual(["confirmed", "cancelled"]);
  });

  it("sales_staff cannot confirm or cancel", () => {
    expect(getAllowedNextStatuses("contacted", "sales_staff")).toEqual([]);
  });

  it("only owner can reopen a cancelled request", () => {
    expect(getAllowedNextStatuses("cancelled", "owner")).toEqual(["new"]);
    expect(getAllowedNextStatuses("cancelled", "manager")).toEqual([]);
  });

  it("confirmed can only move to cancelled, and only for owner/manager", () => {
    expect(getAllowedNextStatuses("confirmed", "owner")).toEqual(["cancelled"]);
    expect(getAllowedNextStatuses("confirmed", "sales_staff")).toEqual([]);
  });

  it("returns nothing for an unauthenticated/null role", () => {
    expect(getAllowedNextStatuses("new", null)).toEqual([]);
  });
});

// ── updateWebsiteRequestStatus ──────────────────────────────────────────────────

describe("updateWebsiteRequestStatus", () => {
  it("rejects an invalid status value before touching auth or the database", async () => {
    // @ts-expect-error intentionally invalid input
    const result = await updateWebsiteRequestStatus("req-1", "not-a-status");

    expect(result.error).toBeTruthy();
    expect(mockRequireStaffPermission).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the user is not signed in / not permitted", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You must be signed in to manage website requests.",
    });

    const result = await updateWebsiteRequestStatus("req-1", "contacted");

    expect(result.error).toBe("You must be signed in to manage website requests.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 'not found' when the request does not exist", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: null, error: null }));
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "sales_staff",
      error: null,
    });

    const result = await updateWebsiteRequestStatus("missing", "contacted");

    expect(result.error).toBe("Website request not found.");
  });

  it("rejects a transition that isn't in the allowed state machine", async () => {
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { status: "cancelled" }, error: null }));
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "manager",
      error: null,
    });

    // cancelled -> confirmed is not a valid transition (only cancelled -> new is)
    const result = await updateWebsiteRequestStatus("req-1", "confirmed");

    expect(result.error).toMatch(/cannot move/i);
  });

  it("blocks sales_staff from confirming a request (role lacks permission for this transition)", async () => {
    mockFrom.mockReturnValueOnce(chainResolveAll({ data: { status: "new" }, error: null }));
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "sales_staff",
      error: null,
    });

    const result = await updateWebsiteRequestStatus("req-1", "confirmed");

    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("allows sales_staff to mark a new request contacted", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { status: "new" }, error: null })) // current status
      .mockReturnValueOnce(
        chainResolveAll({ data: { ...baseRequest, status: "contacted" }, error: null }),
      ); // update

    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "sales_staff",
      error: null,
    });

    const result = await updateWebsiteRequestStatus("req-1", "contacted");

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("contacted");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_website_request_status",
        tableName: "website_order_requests",
        recordId: "req-1",
        userId: "user-1",
      }),
    );
  });

  it("allows manager to confirm a new request directly", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { status: "new" }, error: null }))
      .mockReturnValueOnce(
        chainResolveAll({ data: { ...baseRequest, status: "confirmed" }, error: null }),
      );

    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-2",
      role: "manager",
      error: null,
    });

    const result = await updateWebsiteRequestStatus("req-1", "confirmed");

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("confirmed");
  });

  it("returns a friendly error, never a raw Supabase error, when the update fails", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { status: "new" }, error: null }))
      .mockReturnValueOnce(
        chainResolveAll({ data: null, error: { message: "constraint violation xyz" } }),
      );

    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "owner",
      error: null,
    });

    const result = await updateWebsiteRequestStatus("req-1", "cancelled");

    expect(result.error).toBe("Website request could not be updated.");
    expect(result.error).not.toContain("constraint violation");
  });

  it("never touches stock_movements, product_variants, or orders — confirming/cancelling never deducts stock", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: { status: "new" }, error: null }))
      .mockReturnValueOnce(
        chainResolveAll({ data: { ...baseRequest, status: "confirmed" }, error: null }),
      );

    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom },
      userId: "user-1",
      role: "owner",
      error: null,
    });

    await updateWebsiteRequestStatus("req-1", "confirmed");

    const queriedTables = mockFrom.mock.calls.map((call) => call[0]);
    for (const forbidden of ["stock_movements", "product_variants", "orders", "order_items"]) {
      expect(queriedTables).not.toContain(forbidden);
    }
    expect(queriedTables.every((table) => table === "website_order_requests")).toBe(true);
  });
});
