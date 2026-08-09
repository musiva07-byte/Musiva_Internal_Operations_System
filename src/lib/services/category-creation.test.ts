/**
 * Tests for createCategory() (product.service.ts) — the "+ Add new category"
 * flow from the product form. Covers permission checks, validation, the
 * case-insensitive duplicate rule, and slug generation/uniqueness.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRequireStaffPermission } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("./audit.service", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { createCategory } from "./product.service";

const existingCategories = [
  { id: "cat-1", name: "Dresses" },
  { id: "cat-2", name: "Abayas" },
];

function setupMocks({
  slugTaken = new Set<string>(),
  insertShouldFail = false,
}: { slugTaken?: Set<string>; insertShouldFail?: boolean } = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "categories") {
      return {
        select: (columns: string, opts?: { count?: string }) => {
          if (opts?.count) {
            // slug uniqueness check
            return {
              eq: (_field: string, value: string) =>
                Promise.resolve({ count: slugTaken.has(value) ? 1 : 0 }),
            };
          }
          // duplicate-name fetch
          return Promise.resolve({ data: existingCategories });
        },
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: () =>
              insertShouldFail
                ? Promise.resolve({ data: null, error: { message: "unique violation" } })
                : Promise.resolve({
                    data: { id: "cat-new", ...payload, created_at: "now", updated_at: "now" },
                    error: null,
                  }),
          }),
        }),
      };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });

  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom },
    userId: "user-1",
    role: "inventory_staff",
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCategory", () => {
  it("rejects a blank name without checking permission", async () => {
    const result = await createCategory("   ");
    expect(result.error).toBe("Category name is required.");
    expect(mockRequireStaffPermission).not.toHaveBeenCalled();
  });

  it("rejects a name over the max length", async () => {
    const result = await createCategory("A".repeat(61));
    expect(result.error).toMatch(/60 characters or fewer/);
  });

  it("returns an error when the user lacks permission", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });
    const result = await createCategory("Kaftans");
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("rejects a case-insensitive duplicate", async () => {
    setupMocks();
    const result = await createCategory("dresses");
    expect(result.error).toBe("This category already exists.");
  });

  it("rejects a duplicate with different surrounding whitespace/case", async () => {
    setupMocks();
    const result = await createCategory("  ABAYAS  ");
    expect(result.error).toBe("This category already exists.");
  });

  it("creates a category with a slug derived from the name", async () => {
    setupMocks();
    const result = await createCategory("Kaftans");
    expect(result.error).toBeNull();
    expect(result.data?.name).toBe("Kaftans");
    expect(result.data?.slug).toBe("kaftans");
  });

  it("suffixes the slug when it collides", async () => {
    setupMocks({ slugTaken: new Set(["kids-wear"]) });
    const result = await createCategory("Kids Wear");
    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("kids-wear-2");
  });

  it("trims the name before saving", async () => {
    setupMocks();
    const result = await createCategory("  Scarves  ");
    expect(result.error).toBeNull();
    expect(result.data?.name).toBe("Scarves");
  });

  it("returns a friendly error if the insert itself fails (e.g. a race)", async () => {
    setupMocks({ insertShouldFail: true });
    const result = await createCategory("Party Wear");
    expect(result.error).toBe("This category already exists.");
  });
});
