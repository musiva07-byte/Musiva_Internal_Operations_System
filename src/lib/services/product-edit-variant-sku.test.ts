/**
 * Tests for the "add variant" flow inside updateProduct() (Edit Product save) —
 * product.service.ts.
 *
 * Root cause fixed in this unit: unlike the create wizard (where the option code is always
 * server-generated — see product-sku-generation.test.ts), the Edit Product form exposes
 * Variant SKU as a plain editable input. But updateProduct()'s new-variant INSERT branch
 * used to write whatever the client sent completely unchecked. A staff-typed code that
 * collided (or the field left at its old unedited default) hit the database's unique
 * constraint on product_variants.variant_sku and surfaced only as a generic "A new variant
 * could not be added." — with no indication of what actually went wrong. resolveEditVariantSku
 * now: respects a staff-typed code but reports a conflict instead of silently changing it
 * (same principle as resolveProductSku), and auto-generates + auto-suffixes from
 * product code/color/size when left blank (same principle as resolveVariantSku, used by
 * createProduct).
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

import { updateProduct } from "./product.service";
import type { ProductInput, ProductVariantInput } from "@/lib/validations/product.schema";

function countResult(count: number) {
  const result = {
    neq: () => countResult(count),
    then: (resolve: (v: { count: number }) => void) => resolve({ count }),
  };
  return result;
}

type TakenChecker = { has(value: string): boolean };

type TableConfig = {
  variantSkuTaken?: TakenChecker;
  /** Simulates a race where the pre-check passed but the INSERT itself still collided. */
  variantInsertUniqueViolation?: boolean;
};

function makeNewVariant(overrides: Partial<ProductVariantInput> = {}): ProductVariantInput {
  return {
    // id intentionally omitted — this is what marks it as a new variant to add.
    variantSku: "",
    barcode: null,
    color: "Black",
    size: "M",
    costPrice: 0,
    sellingPrice: 11,
    discountPrice: null,
    regularSellingPriceBhd: 11,
    discountPriceBhd: null,
    discountStartAt: null,
    discountEndAt: null,
    stockQuantity: 0,
    minimumStock: 1,
    status: "active",
    buyingPriceInr: 0,
    importCostBhd: 0,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Satin Dress",
    sku: "05T",
    categoryId: null,
    collection: null,
    description: null,
    material: null,
    careInstructions: null,
    status: "active",
    slug: "satin-dress",
    websiteVisible: false,
    onlineStatus: "hidden",
    websiteTitle: null,
    websiteDescription: null,
    seoTitle: null,
    seoDescription: null,
    featured: false,
    newArrival: false,
    sortOrder: 0,
    images: [],
    openingCost: null,
    variants: [makeNewVariant()],
    ...overrides,
  } as ProductInput;
}

function setupMocks(config: TableConfig = {}) {
  const variantSkuTaken: TakenChecker = config.variantSkuTaken ?? new Set<string>();
  const variantInsertPayloads: Record<string, unknown>[] = [];

  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { website_visible: false, online_status: "hidden" } }),
            neq: () => countResult(0),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "product-1", sku: "05T" }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "product_variants") {
      return {
        select: () => ({
          eq: (_field: string, value: string) => countResult(variantSkuTaken.has(value) ? 1 : 0),
        }),
        insert: (payload: Record<string, unknown>) => {
          variantInsertPayloads.push(payload);
          if (config.variantInsertUniqueViolation) {
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: "23505", message: "duplicate key value violates unique constraint" },
                  }),
              }),
            };
          }
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: `variant-${variantInsertPayloads.length}`, ...payload },
                  error: null,
                }),
            }),
          };
        },
      };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });

  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom, rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    userId: "user-1",
    role: "owner",
    error: null,
  });

  return { getVariantInsertPayloads: () => variantInsertPayloads };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProduct — new variant option code (blank input)", () => {
  it("auto-generates the option code from product code + color + size when left blank", async () => {
    const mocks = setupMocks();
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "", color: "Black", size: "M" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-M");
  });

  it("auto-suffixes the generated code on collision instead of failing", async () => {
    const mocks = setupMocks({ variantSkuTaken: new Set(["05T-BLA-M"]) });
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "", color: "Black", size: "M" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-M-2");
  });

  it("saves a new variant whose id arrives as an empty string, not just omitted (regression — the actual Review & Save bug)", async () => {
    // Reproduces exactly what the Edit Product form submits: a new variant's id round-trips
    // through <input type="hidden" {...form.register(`variants.${index}.id`)} />, so it
    // arrives here as "" rather than being absent from the object. Before the fix,
    // productSchema.safeParse() rejected this at the top of updateProduct() with "Invalid
    // input" (z.string().uuid().optional() does not accept ""), so the request never even
    // reached the variant-insert branch this whole describe block exercises.
    const mocks = setupMocks();
    const result = await updateProduct(
      "product-1",
      baseInput({
        variants: [{ ...makeNewVariant({ color: "Black", size: "M" }), id: "" }],
      }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()).toHaveLength(1);
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-M");
  });

  it("also treats whitespace-only input as blank", async () => {
    const mocks = setupMocks();
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "   ", color: "White", size: "S" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-WHI-S");
  });
});

describe("updateProduct — new variant option code (staff-typed input)", () => {
  it("preserves a staff-typed option code exactly when it is unique", async () => {
    const mocks = setupMocks();
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "CUSTOM-CODE-1" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("CUSTOM-CODE-1");
  });

  it("reports a friendly conflict — never silently changes a staff-typed code that collides", async () => {
    const mocks = setupMocks({ variantSkuTaken: new Set(["DUPLICATE-CODE"]) });
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "DUPLICATE-CODE" })] }),
    );

    expect(result.error).toBe(
      "This option code already exists. Please change the product code, color, or size.",
    );
    expect(result.error).not.toMatch(/barcode/i);
    expect(mocks.getVariantInsertPayloads()).toHaveLength(0);
  });

  it("translates a database unique-violation on insert (race condition) into the same friendly message", async () => {
    setupMocks({ variantInsertUniqueViolation: true });
    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ variantSku: "RACE-CODE" })] }),
    );

    expect(result.error).toBe(
      "This option code already exists. Please change the product code, color, or size.",
    );
    expect(result.error).not.toMatch(/barcode/i);
  });
});

describe("updateProduct — new variant barcode handling", () => {
  it("stores NULL when barcode is an empty string", async () => {
    const mocks = setupMocks();
    await updateProduct("product-1", baseInput({ variants: [makeNewVariant({ barcode: "" })] }));
    expect(mocks.getVariantInsertPayloads()[0].barcode).toBeNull();
  });

  it("stores NULL when barcode is null", async () => {
    const mocks = setupMocks();
    await updateProduct("product-1", baseInput({ variants: [makeNewVariant({ barcode: null })] }));
    expect(mocks.getVariantInsertPayloads()[0].barcode).toBeNull();
  });
});

describe("updateProduct — new variant opening stock", () => {
  it("records opening stock via add_variant_stock when the new variant has a starting quantity", async () => {
    setupMocks();
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom, rpc },
      userId: "user-1",
      role: "owner",
      error: null,
    });

    const result = await updateProduct(
      "product-1",
      baseInput({ variants: [makeNewVariant({ stockQuantity: 5 })] }),
    );

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith(
      "add_variant_stock",
      expect.objectContaining({ p_quantity: 5, p_movement_type: "opening_stock" }),
    );
  });

  it("does not call add_variant_stock when the new variant starts at zero stock", async () => {
    setupMocks();
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom, rpc },
      userId: "user-1",
      role: "owner",
      error: null,
    });

    await updateProduct("product-1", baseInput({ variants: [makeNewVariant({ stockQuantity: 0 })] }));

    expect(rpc).not.toHaveBeenCalled();
  });
});
