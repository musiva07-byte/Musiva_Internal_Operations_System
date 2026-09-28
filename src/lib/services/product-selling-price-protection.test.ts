/**
 * STAFF CRITICAL PATH — Edit Product must never change selling price by accident.
 *
 * Real incident: staff editing unrelated product/website details (or just buying/import cost)
 * had the customer-facing selling price silently overwritten, because the Edit Product save
 * flow always submitted a "selling price" value derived from cost + a (usually zero) profit
 * figure, and updateProduct() always wrote it unconditionally for every variant.
 *
 * The fix: the client computes sellingPriceTouched per variant right before every submit (true
 * only for a brand-new variant, or when the submitted price genuinely differs from what's
 * already stored — see ProductForm.withSellingPriceTouched), and updateProduct() here uses that
 * flag to decide whether selling_price/regular_selling_price_bhd are even included in the
 * UPDATE statement. When omitted, Postgres leaves the stored price completely untouched no
 * matter what numeric value happens to be in the rest of the payload.
 *
 * This file exercises the SERVER half of that contract directly (the client half — dirty
 * tracking, the confirmation dialog's seeding, bulk-apply's checkbox gate — is covered in
 * product-form.test.ts and price-confirmation-dialog.test.ts).
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
    variantSku: "16B1ACD5-BLK-XXL",
    barcode: null,
    color: "Black",
    size: "XXL",
    costPrice: 0,
    // The staff member's real, intended price — 7.605, matching the reported incident.
    sellingPrice: 7.605,
    discountPrice: null,
    regularSellingPriceBhd: 7.605,
    discountPriceBhd: null,
    discountStartAt: null,
    discountEndAt: null,
    stockQuantity: 5,
    minimumStock: 1,
    status: "active",
    buyingPriceInr: 0,
    importCostBhd: 0,
    sellingPriceTouched: false,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "KURTHI 3 PEASE SET",
    sku: "16B1ACD5",
    categoryId: null,
    collection: null,
    description: null,
    material: null,
    careInstructions: null,
    status: "active",
    slug: "kurthi-3-pease-set",
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
            neq: () => countResult(0),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "product-1", sku: "16B1ACD5" }, error: null }),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProduct — selling price is never touched unless the client marks it intentional", () => {
  it("test A/B: editing only unrelated product/website details leaves selling price completely out of the UPDATE payload", async () => {
    const mocks = setupMocks();
    // Only the website description changed; the variant's price fields are still whatever the
    // (buggy, pre-fix) client might compute, but sellingPriceTouched is false.
    const input = baseInput({
      websiteDescription: "Now with a new, elegant description.",
      variants: [makeVariant({ sellingPriceTouched: false, regularSellingPriceBhd: 3.5, sellingPrice: 3.5 })],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const [payload] = mocks.getVariantUpdatePayloads();
    expect(payload).not.toHaveProperty("selling_price");
    expect(payload).not.toHaveProperty("regular_selling_price_bhd");
  });

  it("test B: buying/import cost changed, selling price untouched — cost columns update, price columns are omitted", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      openingCost: {
        buyingCurrency: "INR",
        buyingPricePerPiece: 0,
        exchangeRateToBhd: 0.00452,
        exchangeRateDate: "2026-07-08",
        exchangeRateSource: "manual",
      },
      variants: [
        makeVariant({ buyingPriceInr: 1500, importCostBhd: 0.5, sellingPriceTouched: false }),
      ],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const [payload] = mocks.getVariantUpdatePayloads();
    expect(payload.latest_supplier_unit_cost_inr).toBe(1500);
    expect(payload).not.toHaveProperty("selling_price");
    expect(payload).not.toHaveProperty("regular_selling_price_bhd");
  });

  it("test E: staff explicitly changes the price (sellingPriceTouched = true) — price is written", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      variants: [
        makeVariant({ regularSellingPriceBhd: 9.5, sellingPrice: 9.5, sellingPriceTouched: true }),
      ],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const [payload] = mocks.getVariantUpdatePayloads();
    expect(payload.selling_price).toBe(9.5);
    expect(payload.regular_selling_price_bhd).toBe(9.5);
  });

  it("test H: sellingPriceTouched omitted (schema default false) behaves exactly like an explicit false", async () => {
    const mocks = setupMocks();
    const variant = makeVariant({ regularSellingPriceBhd: 999, sellingPrice: 999 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (variant as any).sellingPriceTouched;
    const input = baseInput({ variants: [variant] });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const [payload] = mocks.getVariantUpdatePayloads();
    expect(payload).not.toHaveProperty("selling_price");
    expect(payload).not.toHaveProperty("regular_selling_price_bhd");
  });

  it("never treats an empty/zero profit-derived price as a real update — a stray 0 in the payload is ignored when untouched", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      variants: [makeVariant({ regularSellingPriceBhd: 0, sellingPrice: 0, sellingPriceTouched: false })],
    });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const [payload] = mocks.getVariantUpdatePayloads();
    expect(payload).not.toHaveProperty("selling_price");
    expect(payload).not.toHaveProperty("regular_selling_price_bhd");
  });

  it("a brand-new variant (no id) always gets its submitted price on insert, regardless of sellingPriceTouched", async () => {
    setupMocks();
    const insertPayloads: Record<string, unknown>[] = [];
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
                  Promise.resolve({ data: { id: "product-1", sku: "16B1ACD5" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "product_variants") {
        return {
          select: () => ({
            eq: () => ({
              // resolveEditVariantSku's own-code-taken and color/size collision checks
              eq: () => Promise.resolve({ data: [], error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            insertPayloads.push(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({ data: { id: "new-variant-1" }, error: null }),
              }),
            };
          },
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const newVariant = makeVariant({
      id: undefined,
      regularSellingPriceBhd: 5,
      sellingPrice: 5,
      stockQuantity: 0,
      sellingPriceTouched: false, // deliberately false — must not matter for a new variant
    });
    const input = baseInput({ variants: [newVariant] });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0].selling_price).toBe(5);
    expect(insertPayloads[0].regular_selling_price_bhd).toBe(5);
  });
});
