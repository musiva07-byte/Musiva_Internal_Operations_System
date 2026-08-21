/**
 * Tests for addStock() / adjustStock() (inventory.service.ts) — the same functions the
 * Edit Product "Receive stock" and "Correct quantity" modals call (via addStockAction /
 * adjustStockAction), so stock is always written through the stock_movements-creating RPCs
 * (add_variant_stock / adjust_variant_stock) rather than a direct product_variants update.
 * No existing test file covered these before this unit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireStaffPermission } = vi.hoisted(() => ({
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addStock, adjustStock } from "./inventory.service";

const VARIANT_ID = "11111111-1111-4111-8111-111111111111";

function mockAuth(rpc: ReturnType<typeof vi.fn>, role = "owner") {
  mockRequireStaffPermission.mockResolvedValue({
    supabase: { rpc },
    userId: "user-1",
    role,
    error: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("addStock — creates a stock movement via RPC, never a direct table write", () => {
  it("calls add_variant_stock with the submitted quantity, movement type, and note", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "movement-1" }, error: null });
    mockAuth(rpc);

    const result = await addStock({
      productVariantId: VARIANT_ID,
      quantity: 5,
      movementType: "purchase_stock",
      referenceType: null,
      referenceId: null,
      note: "Received from supplier",
    });

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("add_variant_stock", {
      p_variant_id: VARIANT_ID,
      p_quantity: 5,
      p_movement_type: "purchase_stock",
      p_reference_type: null,
      p_reference_id: null,
      p_note: "Received from supplier",
    });
  });

  it("returns the created movement record on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "movement-1", quantity: 5 }, error: null });
    mockAuth(rpc);

    const result = await addStock({
      productVariantId: VARIANT_ID,
      quantity: 5,
      movementType: "purchase_stock",
      referenceType: null,
      referenceId: null,
      note: null,
    });

    expect(result.data).toEqual({ id: "movement-1", quantity: 5 });
  });

  it("shows a friendly error (never the raw Supabase error) and logs the real error when the RPC fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "constraint violation xyz" } });
    mockAuth(rpc);

    const result = await addStock({
      productVariantId: VARIANT_ID,
      quantity: 5,
      movementType: "purchase_stock",
      referenceType: null,
      referenceId: null,
      note: null,
    });

    expect(result.error).toBe("Stock could not be added. Please try again.");
    expect(result.error).not.toMatch(/constraint violation/);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejects a zero or negative quantity before ever reaching the RPC", async () => {
    const rpc = vi.fn();
    mockAuth(rpc);

    const result = await addStock({
      productVariantId: VARIANT_ID,
      quantity: 0,
      movementType: "purchase_stock",
      referenceType: null,
      referenceId: null,
      note: null,
    });

    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("denies an unauthorized role server-side, independent of any UI gating", async () => {
    const rpc = vi.fn();
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: "sales_staff",
      error: "You do not have permission to perform this action.",
    });

    const result = await addStock({
      productVariantId: VARIANT_ID,
      quantity: 5,
      movementType: "purchase_stock",
      referenceType: null,
      referenceId: null,
      note: null,
    });

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("adjustStock — creates a stock movement via RPC, never a direct table write", () => {
  it("calls adjust_variant_stock with the corrected quantity and note", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "movement-2" }, error: null });
    mockAuth(rpc);

    const result = await adjustStock({
      productVariantId: VARIANT_ID,
      newQuantity: 12,
      note: "Stock count correction: recounted after stocktake",
      referenceType: "manual_adjustment",
      referenceId: null,
    });

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("adjust_variant_stock", {
      p_variant_id: VARIANT_ID,
      p_new_quantity: 12,
      p_reference_type: "manual_adjustment",
      p_reference_id: null,
      p_note: "Stock count correction: recounted after stocktake",
    });
  });

  it("requires a note of at least 3 characters (audit trail can never be blank)", async () => {
    const rpc = vi.fn();
    mockAuth(rpc);

    const result = await adjustStock({
      productVariantId: VARIANT_ID,
      newQuantity: 12,
      note: "ok",
      referenceType: "manual_adjustment",
      referenceId: null,
    });

    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows a friendly error (never the raw Supabase error) and logs the real error when the RPC fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "duplicate key xyz" } });
    mockAuth(rpc);

    const result = await adjustStock({
      productVariantId: VARIANT_ID,
      newQuantity: 12,
      note: "Stock count correction",
      referenceType: "manual_adjustment",
      referenceId: null,
    });

    expect(result.error).toBe("Stock adjustment could not be recorded. Please check the quantity and try again.");
    expect(result.error).not.toMatch(/duplicate key/);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("denies an unauthorized role server-side, independent of any UI gating", async () => {
    const rpc = vi.fn();
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: "delivery_coordinator",
      error: "You do not have permission to perform this action.",
    });

    const result = await adjustStock({
      productVariantId: VARIANT_ID,
      newQuantity: 12,
      note: "Stock count correction",
      referenceType: "manual_adjustment",
      referenceId: null,
    });

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(rpc).not.toHaveBeenCalled();
  });
});
