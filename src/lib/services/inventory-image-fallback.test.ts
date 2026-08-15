/**
 * Tests for the image-fallback wiring in listInventoryVariants() (Stock Management rows).
 * The fallback rule itself (color image → main image → null) is already exhaustively
 * tested in lib/utils/product-image.test.ts — this covers only that the service actually
 * calls it per row using that row's own color, rather than always showing the main image.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

import { listInventoryVariants } from "./inventory.service";

const variantRows = [
  {
    id: "v-black",
    product_id: "product-1",
    color: "Black",
    size: "M",
    stock_quantity: 5,
    minimum_stock: 1,
    selling_price: 10,
    regular_selling_price_bhd: 10,
    discount_price_bhd: null,
    discount_start_at: null,
    discount_end_at: null,
    products: { name: "Satin Dress", sku: "05T", categories: { name: "Dresses" } },
  },
  {
    id: "v-white",
    product_id: "product-1",
    color: "White",
    size: "M",
    stock_quantity: 3,
    minimum_stock: 1,
    selling_price: 10,
    regular_selling_price_bhd: 10,
    discount_price_bhd: null,
    discount_start_at: null,
    discount_end_at: null,
    products: { name: "Satin Dress", sku: "05T", categories: { name: "Dresses" } },
  },
];

const imageRows = [
  { product_id: "product-1", url: "https://cdn/main.jpg", color: null },
  { product_id: "product-1", url: "https://cdn/black.jpg", color: "Black" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === "product_variants") {
      // Supabase's query builder is "thenable": every filter method returns the same
      // chainable object (so filters can be applied in any order after .range()), and
      // awaiting it at the end is what actually resolves the query.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        order: () => chain,
        eq: () => chain,
        neq: () => chain,
        or: () => chain,
        gt: () => chain,
        filter: () => chain,
        range: () => chain,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: variantRows, count: variantRows.length, error: null }),
      };
      return chain;
    }
    if (table === "product_images") {
      return {
        select: () => ({
          in: () => ({ order: () => Promise.resolve({ data: imageRows, error: null }) }),
        }),
      };
    }
    return { select: () => ({ data: [], error: null }) };
  });
});

describe("listInventoryVariants — image fallback", () => {
  it("uses the color's own image for a variant whose color has one", async () => {
    const result = await listInventoryVariants();
    const black = result.data.find((v) => v.color === "Black");
    expect(black?.primary_image_url).toBe("https://cdn/black.jpg");
  });

  it("falls back to the main image for a variant whose color has no image", async () => {
    const result = await listInventoryVariants();
    const white = result.data.find((v) => v.color === "White");
    expect(white?.primary_image_url).toBe("https://cdn/main.jpg");
  });
});
