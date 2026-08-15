/**
 * Tests for buying-cost persistence in updateProduct() (product.service.ts).
 *
 * Found during this unit: updateProduct()'s existing-variant UPDATE path never wrote
 * latest_supplier_unit_cost_inr / latest_exchange_rate_to_bhd / latest_additional_landed_cost_bhd
 * / latest_landed_cost_bhd / average_landed_cost_bhd at all — editing a variant's buying
 * cost from Product Edit silently did nothing. These tests cover the fix: cost columns are
 * only written when a buying price was actually submitted (via openingCost), and are left
 * completely untouched otherwise, so editing just the selling price can never wipe a
 * variant's previously-recorded cost.
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

function makeVariant(overrides: Partial<ProductVariantInput> = {}): ProductVariantInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    variantSku: "05T-BLA-M",
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
    stockQuantity: 5,
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
    variants: [makeVariant()],
    ...overrides,
  } as ProductInput;
}

function setupMocks() {
  const variantUpdatePayloads: Record<string, unknown>[] = [];

  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { website_visible: false, online_status: "hidden" } }),
            // slug/sku uniqueness checks use count-style select
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
        update: (payload: Record<string, unknown>) => {
          variantUpdatePayloads.push(payload);
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        },
      };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });

  mockRequireStaffPermission.mockResolvedValue({
    supabase: { from: mockFrom },
    userId: "user-1",
    role: "owner",
    error: null,
  });

  return { getVariantUpdatePayloads: () => variantUpdatePayloads };
}

// resolveProductSku/resolveProductSlug both run their own .select().eq() count checks against
// the "products" table before the update — the mock above returns count 0 (never taken) via
// the same chain shape used elsewhere in this file's `products` handler, and neq() covers the
// self-excluding check.

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProduct — buying cost persistence", () => {
  it("writes buying-cost columns when a buying price and rate are submitted", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      openingCost: {
        buyingCurrency: "INR",
        buyingPricePerPiece: 0,
        exchangeRateToBhd: 0.00452,
        exchangeRateDate: "2026-07-08",
        exchangeRateSource: "manual",
      },
      variants: [makeVariant({ buyingPriceInr: 1500, importCostBhd: 0.5 })],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const payload = mocks.getVariantUpdatePayloads()[0];
    expect(payload.latest_supplier_unit_cost_inr).toBe(1500);
    expect(payload.latest_exchange_rate_to_bhd).toBe(0.00452);
    expect(payload.latest_additional_landed_cost_bhd).toBe(0.5);
    // converted = 1500 × 0.00452 = 6.78; final = 6.78 + 0.5 = 7.28
    expect(payload.latest_landed_cost_bhd).toBeCloseTo(7.28, 3);
    expect(payload.average_landed_cost_bhd).toBeCloseTo(7.28, 3);
  });

  it("never writes buying-cost columns when no buying price is submitted (preserves existing cost data)", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      openingCost: null,
      variants: [makeVariant({ buyingPriceInr: 0, regularSellingPriceBhd: 12 })],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const payload = mocks.getVariantUpdatePayloads()[0];
    expect(payload).not.toHaveProperty("latest_supplier_unit_cost_inr");
    expect(payload).not.toHaveProperty("latest_exchange_rate_to_bhd");
    expect(payload).not.toHaveProperty("latest_additional_landed_cost_bhd");
    expect(payload).not.toHaveProperty("latest_landed_cost_bhd");
    // Selling price is still updated normally.
    expect(payload.regular_selling_price_bhd).toBe(12);
  });

  it("still updates the selling price and other fields even when cost columns are skipped", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      openingCost: null,
      variants: [makeVariant({ regularSellingPriceBhd: 15, minimumStock: 3 })],
    });

    await updateProduct("product-1", input);

    const payload = mocks.getVariantUpdatePayloads()[0];
    expect(payload.regular_selling_price_bhd).toBe(15);
    expect(payload.minimum_stock).toBe(3);
  });

  it("normalizes a blank barcode to null on update", async () => {
    const mocks = setupMocks();
    const input = baseInput({ variants: [makeVariant({ barcode: "" })] });

    await updateProduct("product-1", input);

    expect(mocks.getVariantUpdatePayloads()[0].barcode).toBeNull();
  });
});
