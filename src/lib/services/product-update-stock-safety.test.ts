/**
 * Locks in the core safety guarantee behind the Edit Product stock UI rework: saving the
 * product form must NEVER change an existing variant's stock_quantity. Stock can only change
 * through addStock()/adjustStock() (which call the add_variant_stock / adjust_variant_stock
 * RPCs and always create a stock_movements row) — see receive-stock-modal.tsx and
 * correct-quantity-modal.tsx, which use those same functions instead of the product form.
 *
 * Before this unit, this was true by omission (updateProduct()'s existing-variant UPDATE
 * payload simply never included stock_quantity) but nothing guarded it — a future edit could
 * have reintroduced a `stock_quantity: variant.stockQuantity` line without any test catching
 * it. This file exists specifically to catch that regression.
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
            neq: () => countResult(0),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "product-1", sku: "05T" }, error: null }),
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

describe("updateProduct — never writes stock_quantity for an existing variant", () => {
  it("omits stock_quantity from the update payload even when the submitted value differs from the original", async () => {
    const mocks = setupMocks();
    // A tampered/stale form submission claiming a very different stock figure — this must
    // never reach the database. (In the real UI this field is a hidden, unregistered-for-
    // editing input — see product-form.tsx — but the server must not trust it either way.)
    const input = baseInput({ variants: [makeVariant({ stockQuantity: 9999 })] });

    const result = await updateProduct("product-1", input);

    expect(result.error).toBeNull();
    const payload = mocks.getVariantUpdatePayloads()[0];
    expect(payload).not.toHaveProperty("stock_quantity");
  });

  it("omits stock_quantity from the update payload on an ordinary save (selling price, status, etc.)", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      variants: [makeVariant({ regularSellingPriceBhd: 20, status: "inactive" })],
    });

    await updateProduct("product-1", input);

    const payload = mocks.getVariantUpdatePayloads()[0];
    expect(payload).not.toHaveProperty("stock_quantity");
    // Confirms the payload is otherwise doing its normal job — this isn't a broken/empty update.
    expect(payload.regular_selling_price_bhd).toBe(20);
    expect(payload.status).toBe("inactive");
  });

  it("omits stock_quantity even across multiple variants in the same save", async () => {
    const mocks = setupMocks();
    const input = baseInput({
      variants: [
        makeVariant({ id: "11111111-1111-4111-8111-111111111111", stockQuantity: 3 }),
        makeVariant({ id: "22222222-2222-4222-8222-222222222223", color: "White", stockQuantity: 7 }),
      ],
    });

    await updateProduct("product-1", input);

    for (const payload of mocks.getVariantUpdatePayloads()) {
      expect(payload).not.toHaveProperty("stock_quantity");
    }
  });
});
