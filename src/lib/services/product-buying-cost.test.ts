/**
 * Tests for the buying-cost portion of createProduct() (product.service.ts).
 *
 * Covers:
 *  - INR → BHD conversion applied to opening stock
 *  - opening-stock inventory_batches row created with the historical snapshot
 *    (supplier cost, exchange rate, rate date, rate source — no import cost)
 *  - the snapshot is exactly what was submitted, never re-read from the live
 *    exchange_rates table, so a later rate change can never alter it
 *  - no import/shipping/customs cost field is ever written
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
import type { ProductInput } from "@/lib/validations/product.schema";

const productRow = { id: "product-1", name: "Satin Dress", sku: "MSV-10001" };
const variantRow = { id: "variant-1" };

function baseInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Satin Dress",
    sku: "MSV-10001",
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
    openingCost: {
      buyingCurrency: "INR",
      buyingPricePerPiece: 0,
      exchangeRateToBhd: 0.00452,
      exchangeRateDate: "2026-07-08",
      exchangeRateSource: "manual",
    },
    variants: [
      {
        variantSku: "MSV-10001-BLK-M",
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
        buyingPriceInr: 1500,
        additionalLandedCostBhd: 0,
      },
    ],
    ...overrides,
  } as ProductInput;
}

function mockHappyPath() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      return {
        select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
      };
    }
    if (table === "product_variants") {
      return {
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) }),
      };
    }
    if (table === "inventory_batches") {
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });

  mockRequireStaffPermission.mockResolvedValue({
    supabase: {
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    userId: "user-1",
    role: "inventory_staff",
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProduct — buying cost", () => {
  it("converts INR buying price to BHD and stores it as the variant's buying cost", async () => {
    mockHappyPath();

    const variantInsertCalls: unknown[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          insert: (payload: unknown) => {
            variantInsertCalls.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) };
          },
        };
      }
      if (table === "inventory_batches") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const result = await createProduct(baseInput());

    expect(result.error).toBeNull();
    // 1500 INR × 0.00452 = 6.780 BHD
    expect(variantInsertCalls[0]).toMatchObject({
      latest_landed_cost_bhd: 6.78,
      average_landed_cost_bhd: 6.78,
      latest_supplier_unit_cost_inr: 1500,
      latest_exchange_rate_to_bhd: 0.00452,
      latest_additional_landed_cost_bhd: 0,
    });
  });

  it("adds the optional additional landed cost on top of the converted price (final cost)", async () => {
    mockHappyPath();

    const variantInsertCalls: unknown[] = [];
    let batchInsertPayload: Record<string, unknown> | null = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          insert: (payload: unknown) => {
            variantInsertCalls.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) };
          },
        };
      }
      if (table === "inventory_batches") {
        return {
          insert: (payload: Record<string, unknown>) => {
            batchInsertPayload = payload;
            return Promise.resolve({ error: null });
          },
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const input = baseInput({
      variants: [
        {
          variantSku: "MSV-10001-BLK-M",
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
          buyingPriceInr: 1500,
          additionalLandedCostBhd: 0.5,
        },
      ],
    });

    const result = await createProduct(input);

    expect(result.error).toBeNull();
    // converted = 1500 × 0.00452 = 6.780; final = 6.780 + 0.5 = 7.280
    expect(variantInsertCalls[0]).toMatchObject({
      latest_landed_cost_bhd: 7.28,
      average_landed_cost_bhd: 7.28,
      latest_supplier_unit_cost_inr: 1500,
      latest_exchange_rate_to_bhd: 0.00452,
      latest_additional_landed_cost_bhd: 0.5,
    });
    expect(batchInsertPayload).toMatchObject({
      converted_unit_cost_bhd: 6.78,
      allocated_import_cost_bhd: 0.5,
      landed_unit_cost_bhd: 7.28,
    });
  });

  it("creates an opening-stock inventory_batches row with the historical rate snapshot", async () => {
    mockHappyPath();

    let batchInsertPayload: Record<string, unknown> | null = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) }),
        };
      }
      if (table === "inventory_batches") {
        return {
          insert: (payload: Record<string, unknown>) => {
            batchInsertPayload = payload;
            return Promise.resolve({ error: null });
          },
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    await createProduct(baseInput());

    expect(batchInsertPayload).toMatchObject({
      purchase_order_item_id: null,
      batch_type: "opening_stock",
      supplier_unit_cost: 1500,
      supplier_currency: "INR",
      exchange_rate_to_bhd: 0.00452,
      exchange_rate_date: "2026-07-08",
      exchange_rate_source: "manual",
      converted_unit_cost_bhd: 6.78,
      landed_unit_cost_bhd: 6.78,
      allocated_import_cost_bhd: 0,
    });
  });

  it("additional landed cost defaults to 0 (allocated_import_cost_bhd) when not entered", async () => {
    mockHappyPath();

    let batchInsertPayload: Record<string, unknown> | null = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) }),
        };
      }
      if (table === "inventory_batches") {
        return {
          insert: (payload: Record<string, unknown>) => {
            batchInsertPayload = payload;
            return Promise.resolve({ error: null });
          },
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    // baseInput's variant leaves additionalLandedCostBhd at its default (0).
    await createProduct(baseInput());

    expect(batchInsertPayload).not.toBeNull();
    const payload = batchInsertPayload as unknown as Record<string, unknown>;
    expect(payload.allocated_import_cost_bhd).toBe(0);
    expect(Object.keys(payload)).not.toContain("extra_import_cost_bhd");
  });

  it("never reads the live exchange_rates table — the snapshot comes only from the submitted input", async () => {
    mockHappyPath();
    await createProduct(baseInput());

    const queriedTables = mockFrom.mock.calls.map((call) => call[0]);
    expect(queriedTables).not.toContain("exchange_rates");
  });

  it("records no cost data when no buying price is entered for any variant", async () => {
    mockHappyPath();

    let batchTableTouched = false;
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0 }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: productRow, error: null }) }) }),
        };
      }
      if (table === "product_variants") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: variantRow, error: null }) }) }),
        };
      }
      if (table === "inventory_batches") {
        batchTableTouched = true;
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const input = baseInput({
      openingCost: null,
      variants: [
        {
          variantSku: "MSV-10001-BLK-M",
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
          additionalLandedCostBhd: 0,
        },
      ],
    });

    await createProduct(input);

    expect(batchTableTouched).toBe(false);
  });
});
