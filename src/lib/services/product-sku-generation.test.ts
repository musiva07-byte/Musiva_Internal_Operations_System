/**
 * Tests for SKU/barcode handling in createProduct() (product.service.ts).
 *
 * Business rule: staff may type a product code, or leave it blank to
 * auto-generate one from the product name. Variant ("option") codes are
 * always derived server-side from the product code + color + size, never
 * staff-typed, and are made unique with a numeric suffix on collision.
 * Barcode is optional and always normalized to NULL when blank.
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

import { createProduct } from "./product.service";
import type { ProductInput, ProductVariantInput } from "@/lib/validations/product.schema";

// ── Chainable count-query mock ──────────────────────────────────────────────
// Mirrors the .select("id", {count:"exact",head:true}).eq(field, value)[.neq(...)]
// shape used by resolveProductSlug / resolveProductSku / resolveVariantSku.

function countResult(count: number) {
  const result = {
    neq: () => countResult(count),
    then: (resolve: (v: { count: number }) => void) => resolve({ count }),
  };
  return result;
}

type TakenChecker = { has(value: string): boolean };

type TableConfig = {
  skuTaken?: Set<string>;
  slugTaken?: Set<string>;
  variantSkuTaken?: TakenChecker;
  variantInsertShouldFail?: boolean;
};

function makeVariant(overrides: Partial<ProductVariantInput> = {}): ProductVariantInput {
  return {
    variantSku: "placeholder", // always recomputed server-side; value here is irrelevant
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
    name: "Western Top",
    sku: "",
    categoryId: null,
    collection: null,
    description: null,
    material: null,
    careInstructions: null,
    status: "active",
    slug: null,
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
    variants: [makeVariant()],
    ...overrides,
  } as ProductInput;
}

function setupMocks(config: TableConfig = {}) {
  const skuTaken = config.skuTaken ?? new Set<string>();
  const slugTaken = config.slugTaken ?? new Set<string>();
  const variantSkuTaken: TakenChecker = config.variantSkuTaken ?? new Set<string>();
  let productInsertPayload: Record<string, unknown> | null = null;
  const variantInsertPayloads: Record<string, unknown>[] = [];
  let productDeleted = false;

  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return {
        select: () => ({
          eq: (field: string, value: string) => {
            if (field === "sku") return countResult(skuTaken.has(value) ? 1 : 0);
            if (field === "slug") return countResult(slugTaken.has(value) ? 1 : 0);
            return countResult(0);
          },
        }),
        insert: (payload: Record<string, unknown>) => {
          productInsertPayload = payload;
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "product-1", ...payload }, error: null }),
            }),
          };
        },
        delete: () => ({
          eq: () => {
            productDeleted = true;
            return Promise.resolve({ error: null });
          },
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
          if (config.variantInsertShouldFail) {
            return {
              select: () => ({
                single: () => Promise.resolve({ data: null, error: { message: "db error" } }),
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
    if (table === "inventory_batches") {
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });

  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom, rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    userId: "user-1",
    role: "inventory_staff",
    error: null,
  });

  return {
    getProductInsertPayload: () => productInsertPayload,
    getVariantInsertPayloads: () => variantInsertPayloads,
    wasProductDeleted: () => productDeleted,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Product SKU behavior ─────────────────────────────────────────────────────

describe("createProduct — product SKU behavior", () => {
  it("preserves a staff-entered product SKU exactly", async () => {
    const mocks = setupMocks();
    const result = await createProduct(baseInput({ sku: "05T" }));

    expect(result.error).toBeNull();
    expect(mocks.getProductInsertPayload()?.sku).toBe("05T");
  });

  it("auto-generates the product SKU from the name only when blank", async () => {
    const mocks = setupMocks();
    const result = await createProduct(baseInput({ sku: "", name: "Western Top" }));

    expect(result.error).toBeNull();
    expect(mocks.getProductInsertPayload()?.sku).toBe("WES-TOP");
  });

  it("does not silently change a staff-entered SKU that collides — returns a friendly conflict error", async () => {
    const mocks = setupMocks({ skuTaken: new Set(["05T"]) });
    const result = await createProduct(baseInput({ sku: "05T" }));

    expect(result.error).toMatch(/already exists/i);
    expect(result.error).not.toMatch(/barcode/i);
    expect(mocks.getProductInsertPayload()).toBeNull();
  });

  it("auto-suffixes a generated product SKU that collides (never staff-chosen, so safe to change)", async () => {
    const mocks = setupMocks({ skuTaken: new Set(["WES-TOP"]) });
    const result = await createProduct(baseInput({ sku: "", name: "Western Top" }));

    expect(result.error).toBeNull();
    expect(mocks.getProductInsertPayload()?.sku).toBe("WES-TOP-2");
  });
});

// ── Variant SKU ("option code") behavior ────────────────────────────────────

describe("createProduct — variant SKU behavior", () => {
  it("generates the variant SKU from staff-entered product SKU + color + size", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({ sku: "05T", variants: [makeVariant({ color: "BLACK", size: "XL" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-XL");
  });

  it("generates the variant SKU from an auto-generated product SKU + color + size", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({
        sku: "",
        name: "Western Top",
        variants: [makeVariant({ color: "Peach", size: "XXL" })],
      }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("WES-TOP-PEA-XXL");
  });

  it("appends a numeric suffix when the generated variant SKU already exists", async () => {
    const mocks = setupMocks({ variantSkuTaken: new Set(["05T-BLA-XL"]) });
    const result = await createProduct(
      baseInput({ sku: "05T", variants: [makeVariant({ color: "BLACK", size: "XL" })] }),
    );

    expect(result.error).toBeNull();
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-XL-2");
  });

  it("de-duplicates identical color/size combinations within the same submission", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({
        sku: "05T",
        variants: [
          makeVariant({ color: "Black", size: "M" }),
          makeVariant({ color: "Black", size: "M" }),
        ],
      }),
    );

    expect(result.error).toBeNull();
    const skus = mocks.getVariantInsertPayloads().map((p) => p.variant_sku);
    expect(skus).toEqual(["05T-BLA-M", "05T-BLA-M-2"]);
  });

  it("succeeds with multiple sizes, giving each a distinct variant SKU", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({
        sku: "05T",
        variants: [
          makeVariant({ color: "Black", size: "S" }),
          makeVariant({ color: "Black", size: "M" }),
          makeVariant({ color: "Black", size: "L" }),
        ],
      }),
    );

    expect(result.error).toBeNull();
    const skus = mocks.getVariantInsertPayloads().map((p) => p.variant_sku);
    expect(skus).toEqual(["05T-BLA-S", "05T-BLA-M", "05T-BLA-L"]);
  });

  it("succeeds with a color containing symbols like BLACK&PINK", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({ sku: "05T", variants: [makeVariant({ color: "BLACK&PINK", size: "M" })] }),
    );

    expect(result.error).toBeNull();
    // Mixed colors generate one code per color (see sku.test.ts) rather than collapsing to one.
    expect(mocks.getVariantInsertPayloads()[0].variant_sku).toBe("05T-BLA-PIN-M");
  });

  it("returns a friendly conflict message (never mentioning barcode) when suffixes are exhausted, and rolls back the product", async () => {
    const alwaysTaken: TakenChecker = { has: () => true };
    const mocks = setupMocks({ variantSkuTaken: alwaysTaken });

    const result = await createProduct(baseInput({ sku: "05T" }));

    expect(result.error).toMatch(/already exists/i);
    expect(result.error).not.toMatch(/barcode/i);
    expect(mocks.wasProductDeleted()).toBe(true);
  });
});

// ── Barcode handling ─────────────────────────────────────────────────────────

describe("createProduct — barcode handling", () => {
  it("stores NULL when barcode is null", async () => {
    const mocks = setupMocks();
    await createProduct(baseInput({ variants: [makeVariant({ barcode: null })] }));
    expect(mocks.getVariantInsertPayloads()[0].barcode).toBeNull();
  });

  it("stores NULL when barcode is undefined", async () => {
    const mocks = setupMocks();
    const variant = makeVariant();
    delete (variant as { barcode?: string | null }).barcode;
    await createProduct(baseInput({ variants: [variant] }));
    expect(mocks.getVariantInsertPayloads()[0].barcode).toBeNull();
  });

  it("stores NULL when barcode is an empty string", async () => {
    const mocks = setupMocks();
    await createProduct(baseInput({ variants: [makeVariant({ barcode: "" })] }));
    expect(mocks.getVariantInsertPayloads()[0].barcode).toBeNull();
  });

  it("does not require a barcode for product creation to succeed", async () => {
    const result = await createProduct(baseInput());
    expect(result.error).toBeNull();
  });

  it("succeeds creating multiple variants with no barcode on any of them", async () => {
    const mocks = setupMocks();
    const result = await createProduct(
      baseInput({
        sku: "05T",
        variants: [
          makeVariant({ color: "Black", size: "S", barcode: "" }),
          makeVariant({ color: "Black", size: "M", barcode: null }),
          makeVariant({ color: "White", size: "S" }),
        ],
      }),
    );

    expect(result.error).toBeNull();
    const payloads = mocks.getVariantInsertPayloads();
    expect(payloads).toHaveLength(3);
    expect(payloads.every((p) => p.barcode === null)).toBe(true);
  });
});

// ── Error message wording ────────────────────────────────────────────────────

describe("createProduct — staff-facing error messages", () => {
  it("reports an unknown variant creation failure without mentioning barcode or SKU internals", async () => {
    setupMocks({ variantInsertShouldFail: true });
    const result = await createProduct(baseInput());

    expect(result.error).toBe(
      "Could not create this product option. Please check the product details and try again.",
    );
    expect(result.error).not.toMatch(/barcode/i);
  });

  it("rolls back the just-created product when a variant fails to insert for an unknown reason", async () => {
    const mocks = setupMocks({ variantInsertShouldFail: true });
    await createProduct(baseInput());

    expect(mocks.wasProductDeleted()).toBe(true);
  });
});
