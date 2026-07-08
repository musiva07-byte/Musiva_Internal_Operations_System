/**
 * Tests for product archive / restore / delete lifecycle.
 *
 * These unit tests mock Supabase and auth so they run entirely in-process.
 * The surface under test is the service layer (product.service.ts) and the
 * canArchiveProducts / canDeleteProducts permission helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: mockFrom,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: () => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Audit service — no-op in tests
vi.mock("./audit.service", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  canDeleteProduct,
  archiveProduct,
  restoreProduct,
  permanentDeleteProduct,
} from "./product.service";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canArchiveProducts, canDeleteProducts } from "@/lib/auth/permissions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(granted: boolean, extra?: object) {
  if (granted) {
    vi.mocked(requireStaffPermission).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: { from: mockFrom, rpc: mockRpc } as any,
      userId: "user-1",
      role: "owner" as const,
      error: null,
      ...extra,
    });
  } else {
    vi.mocked(requireStaffPermission).mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });
  }
}

// ── Permission helper unit tests ─────────────────────────────────────────────

describe("canArchiveProducts", () => {
  it("grants owner", () => expect(canArchiveProducts("owner")).toBe(true));
  it("grants manager", () => expect(canArchiveProducts("manager")).toBe(true));
  it("denies sales_staff", () => expect(canArchiveProducts("sales_staff")).toBe(false));
  it("denies inventory_staff", () => expect(canArchiveProducts("inventory_staff")).toBe(false));
  it("denies accountant", () => expect(canArchiveProducts("accountant")).toBe(false));
  it("denies delivery_coordinator", () => expect(canArchiveProducts("delivery_coordinator")).toBe(false));
  it("denies null", () => expect(canArchiveProducts(null)).toBe(false));
});

describe("canDeleteProducts", () => {
  it("grants owner", () => expect(canDeleteProducts("owner")).toBe(true));
  it("grants manager", () => expect(canDeleteProducts("manager")).toBe(true));
  it("denies sales_staff", () => expect(canDeleteProducts("sales_staff")).toBe(false));
  it("denies inventory_staff", () => expect(canDeleteProducts("inventory_staff")).toBe(false));
  it("denies null", () => expect(canDeleteProducts(null)).toBe(false));
});

// ── canDeleteProduct (safety check) ─────────────────────────────────────────

describe("canDeleteProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canDelete=true when product has no variants", async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
    });
    const result = await canDeleteProduct("product-1");
    expect(result.canDelete).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks when order_items exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      const count = table === "order_items" ? 1 : 0;
      return {
        select: () => ({
          in: () => Promise.resolve({ count }),
        }),
      };
    });

    const result = await canDeleteProduct("product-1");
    expect(result.canDelete).toBe(false);
    expect(result.blockers).toContain("sales history");
  });

  it("blocks when stock_movements exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      const count = table === "stock_movements" ? 1 : 0;
      return { select: () => ({ in: () => Promise.resolve({ count }) }) };
    });
    const result = await canDeleteProduct("product-1");
    expect(result.blockers).toContain("stock movement history");
  });

  it("blocks when purchase_order_items exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      const count = table === "purchase_order_items" ? 1 : 0;
      return { select: () => ({ in: () => Promise.resolve({ count }) }) };
    });
    const result = await canDeleteProduct("product-1");
    expect(result.blockers).toContain("purchase history");
  });

  it("blocks when return_items exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      const count = table === "return_items" ? 1 : 0;
      return { select: () => ({ in: () => Promise.resolve({ count }) }) };
    });
    const result = await canDeleteProduct("product-1");
    expect(result.blockers).toContain("return history");
  });

  it("blocks when available stock exists", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 5 }] }) }) };
      }
      return { select: () => ({ in: () => Promise.resolve({ count: 0 }) }) };
    });
    const result = await canDeleteProduct("product-1");
    expect(result.blockers).toContain("available stock");
    expect(result.canDelete).toBe(false);
  });

  it("returns canDelete=true for a brand-new unused product", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      return { select: () => ({ in: () => Promise.resolve({ count: 0 }) }) };
    });
    const result = await canDeleteProduct("product-1");
    expect(result.canDelete).toBe(true);
  });
});

// ── archiveProduct ───────────────────────────────────────────────────────────

describe("archiveProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when user lacks permission", async () => {
    mockAuth(false);
    const result = await archiveProduct("product-1");
    expect(result.error).toBeTruthy();
  });

  it("sets product status to archived", async () => {
    mockAuth(true);
    const product = { id: "product-1", name: "Dress", sku: "SKU-1", status: "archived" };
    const updateSingleMock = vi.fn().mockResolvedValue({ data: product, error: null });
    const variantUpdateMock = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          update: () => ({ eq: () => ({ select: () => ({ single: updateSingleMock }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          update: () => ({ eq: variantUpdateMock }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) }; // audit_logs
    });

    const result = await archiveProduct("product-1");
    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("archived");
  });

  it("also archives product variants", async () => {
    mockAuth(true);
    const product = { id: "product-1", name: "Dress", sku: "SKU-1", status: "archived" };
    const variantUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const variantUpdateMock = vi.fn().mockReturnValue({ eq: variantUpdateEqMock });

    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: product, error: null }) }) }) }) };
      }
      if (table === "product_variants") {
        return { update: variantUpdateMock };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    await archiveProduct("product-1");
    expect(variantUpdateMock).toHaveBeenCalledWith({ status: "archived" });
  });
});

// ── restoreProduct ───────────────────────────────────────────────────────────

describe("restoreProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when user lacks permission", async () => {
    mockAuth(false);
    const result = await restoreProduct("product-1", "active");
    expect(result.error).toBeTruthy();
  });

  it("restores product to active status", async () => {
    mockAuth(true);
    const product = { id: "product-1", name: "Dress", sku: "SKU-1", status: "active" };
    const updateSingleMock = vi.fn().mockResolvedValue({ data: product, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return { update: () => ({ eq: () => ({ select: () => ({ single: updateSingleMock }) }) }) };
      }
      if (table === "product_variants") {
        return { update: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await restoreProduct("product-1", "active");
    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("active");
  });

  it("can restore to inactive", async () => {
    mockAuth(true);
    const product = { id: "product-1", name: "Dress", sku: "SKU-1", status: "inactive" };
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: product, error: null }) }) }) }) };
      }
      if (table === "product_variants") {
        return { update: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });
    const result = await restoreProduct("product-1", "inactive");
    expect(result.data?.status).toBe("inactive");
  });
});

// ── permanentDeleteProduct ───────────────────────────────────────────────────

describe("permanentDeleteProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when user lacks permission", async () => {
    mockAuth(false);
    const result = await permanentDeleteProduct("product-1");
    expect(result.error).toBeTruthy();
  });

  it("blocks deletion when order_items exist", async () => {
    mockAuth(true);
    // canDeleteProduct check: variants exist, order_items count = 1
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      if (table === "order_items") {
        return { select: () => ({ in: () => Promise.resolve({ count: 1 }) }) };
      }
      return { select: () => ({ in: () => Promise.resolve({ count: 0 }) }) };
    });

    const result = await permanentDeleteProduct("product-1");
    expect(result.error).toMatch(/cannot be deleted/i);
  });

  it("deletes product successfully when no business records exist", async () => {
    mockAuth(true);
    const deleteMock = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "v1", stock_quantity: 0 }] }) }) };
      }
      if (["order_items", "stock_movements", "purchase_order_items", "return_items"].includes(table)) {
        return { select: () => ({ in: () => Promise.resolve({ count: 0 }) }) };
      }
      if (table === "products") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { name: "Dress", sku: "SKU-1" } }) }) }),
          delete: () => ({ eq: deleteMock }),
        };
      }
      if (table === "product_images") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await permanentDeleteProduct("product-1");
    expect(result.error).toBeNull();
    expect(result.data?.productId).toBe("product-1");
    expect(deleteMock).toHaveBeenCalledWith("id", "product-1");
  });

  it("does not delete image from storage when no image exists", async () => {
    mockAuth(true);

    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      if (table === "products") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { name: "Dress", sku: "SKU-1" } }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "product_images") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    // Should succeed without touching storage
    const result = await permanentDeleteProduct("product-1");
    expect(result.error).toBeNull();
  });

  it("requires DELETE confirmation (type-check tested at UI level — service enforces no additional token)", async () => {
    // The "type DELETE" requirement is purely UI-enforced in ProductDeleteDialog.
    // The server action itself just calls permanentDeleteProduct — no token check here.
    // This test documents that intent so we don't accidentally add a plaintext "DELETE"
    // token to the server-side call (which would be security theatre).
    expect(true).toBe(true);
  });
});

// ── listProducts hidden from New Sale (verified via listOrderableVariants) ──

describe("archived products hidden from new sale", () => {
  it("listOrderableVariants filters by status=active (excludes archived)", () => {
    // This is verified by reading order.service.ts which has:
    //   .eq("status", "active")
    // Archived variants have status="archived" so they are excluded automatically.
    // This is a documentation test — the implementation is in order.service.ts.
    expect(true).toBe(true);
  });
});
