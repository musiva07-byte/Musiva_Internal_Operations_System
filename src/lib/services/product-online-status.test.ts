/**
 * Tests for updateProductOnlineStatus() — the quick Publish/Hide/Draft action from the
 * Product Catalog's Status column (WebsiteStatusControl).
 *
 * Mirrors the mocking pattern used in product-lifecycle.test.ts. Publishing must still go
 * through the same getPublishingReadiness()/checkPublishAttempt() rules as the full edit
 * form; hiding or setting draft is never blocked by readiness. Permission is enforced here
 * via requireStaffPermission(canPublishProducts, ...), independent of whatever the client UI
 * shows or hides.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("./audit.service", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { updateProductOnlineStatus } from "./product.service";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canPublishProducts } from "@/lib/auth/permissions";

function mockAuth(granted: boolean) {
  if (granted) {
    vi.mocked(requireStaffPermission).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: { from: mockFrom } as any,
      userId: "user-1",
      role: "owner" as const,
      error: null,
    });
  } else {
    vi.mocked(requireStaffPermission).mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to publish products.",
    });
  }
}

const readyVariantRow = { status: "active", stock_quantity: 5, regular_selling_price_bhd: 15 };

function mockProductLookup(product: {
  name: string;
  sku: string;
  slug: string | null;
  online_status: string;
  website_visible: boolean;
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: product, error: null }) }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { ...product, id: "product-1" },
                  error: null,
                }),
            }),
          }),
        }),
      };
    }
    if (table === "product_variants") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [readyVariantRow] }) }) };
    }
    if (table === "product_images") {
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [{ id: "img-1" }] }) }) }) };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canPublishProducts (permission)", () => {
  it("grants owner", () => expect(canPublishProducts("owner")).toBe(true));
  it("grants manager", () => expect(canPublishProducts("manager")).toBe(true));
  it("denies inventory_staff", () => expect(canPublishProducts("inventory_staff")).toBe(false));
  it("denies accountant", () => expect(canPublishProducts("accountant")).toBe(false));
  it("denies sales_staff", () => expect(canPublishProducts("sales_staff")).toBe(false));
  it("denies delivery_coordinator", () => expect(canPublishProducts("delivery_coordinator")).toBe(false));
  it("denies null", () => expect(canPublishProducts(null)).toBe(false));
});

describe("updateProductOnlineStatus", () => {
  it("returns an error and never touches the database when the caller lacks publish permission", async () => {
    mockAuth(false);
    const result = await updateProductOnlineStatus("product-1", {
      onlineStatus: "published",
      websiteVisible: true,
    });
    expect(result.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("publishes a ready product and logs publish_product", async () => {
    mockAuth(true);
    mockProductLookup({
      name: "Satin Dress",
      sku: "MSV-1",
      slug: "satin-dress",
      online_status: "hidden",
      website_visible: false,
    });

    const result = await updateProductOnlineStatus("product-1", {
      onlineStatus: "published",
      websiteVisible: true,
    });

    expect(result.error).toBeNull();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish_product" }),
    );
  });

  it("blocks publishing an unready product with a friendly message and does not update it", async () => {
    mockAuth(true);
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    name: "Satin Dress",
                    sku: "MSV-1",
                    slug: null, // missing slug — not ready
                    online_status: "hidden",
                    website_visible: false,
                  },
                  error: null,
                }),
            }),
          }),
          update: vi.fn(),
        };
      }
      if (table === "product_variants") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [readyVariantRow] }) }) };
      }
      if (table === "product_images") {
        return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await updateProductOnlineStatus("product-1", {
      onlineStatus: "published",
      websiteVisible: true,
    });

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/not ready to publish|missing required website details/i);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("hides a product without requiring publishing readiness", async () => {
    mockAuth(true);
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    name: "Satin Dress",
                    sku: "MSV-1",
                    slug: null,
                    online_status: "published",
                    website_visible: true,
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "product-1", sku: "MSV-1", online_status: "hidden", website_visible: false },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await updateProductOnlineStatus("product-1", {
      onlineStatus: "hidden",
      websiteVisible: false,
    });

    expect(result.error).toBeNull();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unpublish_product" }),
    );
  });

  it("sets draft without requiring publishing readiness", async () => {
    mockAuth(true);
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    name: "Satin Dress",
                    sku: "MSV-1",
                    slug: null,
                    online_status: "hidden",
                    website_visible: false,
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "product-1", sku: "MSV-1", online_status: "draft", website_visible: false },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await updateProductOnlineStatus("product-1", {
      onlineStatus: "draft",
      websiteVisible: false,
    });

    expect(result.error).toBeNull();
    expect(result.data?.online_status).toBe("draft");
    // Not a publish transition either direction, so no publish/unpublish audit log.
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});
