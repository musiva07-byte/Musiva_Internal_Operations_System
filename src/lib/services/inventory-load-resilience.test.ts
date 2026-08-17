/**
 * Regression tests for the Stock Management "Unable to load data" outage.
 *
 * Root cause: listInventoryVariants() started selecting product_images.color
 * (commit ef62451) without the DB migration that adds it
 * (database/migrations/202607171700_product_color_images.sql) ever being applied to the
 * live Supabase project — every product_images query then failed with Postgres 42703
 * ("column product_images.color does not exist"), which the service treated as a hard
 * failure and returned loadError with zero rows, even though product_variants itself
 * loaded fine.
 *
 * These tests cover the fix: detect that specific missing-column error and fall back to
 * the pre-migration query (no color) instead of failing the whole page, while any other
 * query failure still surfaces the friendly load error (not swallowed into an empty table).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, consoleErrorSpy } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  consoleErrorSpy: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

import { listInventoryVariants } from "./inventory.service";

const variantRows = [
  {
    id: "v-1",
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
    latest_supplier_unit_cost_inr: 1375,
    latest_exchange_rate_to_bhd: 0.0039,
    latest_additional_landed_cost_bhd: 1.95,
    products: { name: "Satin Dress", sku: "05T", categories: { name: "Dresses" } },
  },
];

function variantChain(response: { data: unknown; count: number | null; error: unknown }) {
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
    then: (resolve: (v: unknown) => void) => resolve(response),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(consoleErrorSpy);
});

describe("listInventoryVariants — resilience to the not-yet-applied color-images migration", () => {
  it("loads rows successfully when product_images.color exists (migration applied)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return variantChain({ data: variantRows, count: 1, error: null });
      }
      if (table === "product_images") {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ product_id: "product-1", url: "https://cdn/main.jpg", color: null }],
                  error: null,
                }),
            }),
          }),
        };
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const result = await listInventoryVariants();
    expect(result.loadError).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.primary_image_url).toBe("https://cdn/main.jpg");
  });

  it("falls back to main-image-only display when product_images.color does not exist, instead of failing the page", async () => {
    let colorQueryAttempted = false;
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return variantChain({ data: variantRows, count: 1, error: null });
      }
      if (table === "product_images") {
        return {
          select: (cols: string) => {
            if (cols.includes("color")) {
              colorQueryAttempted = true;
              return {
                in: () => ({
                  order: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: "42703", message: "column product_images.color does not exist" },
                    }),
                }),
              };
            }
            return {
              in: () => ({
                order: () =>
                  Promise.resolve({
                    data: [{ product_id: "product-1", url: "https://cdn/fallback.jpg" }],
                    error: null,
                  }),
              }),
            };
          },
        };
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const result = await listInventoryVariants();

    expect(colorQueryAttempted).toBe(true);
    expect(result.loadError).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.primary_image_url).toBe("https://cdn/fallback.jpg");
    // Still logs server-side so developers know the migration is pending.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("does not crash when a variant has no recorded buying cost (missing INR/rate)", async () => {
    const rowsNoCost = [
      {
        ...variantRows[0],
        latest_supplier_unit_cost_inr: null,
        latest_exchange_rate_to_bhd: null,
        latest_additional_landed_cost_bhd: 0,
      },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return variantChain({ data: rowsNoCost, count: 1, error: null });
      }
      if (table === "product_images") {
        return { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const result = await listInventoryVariants();
    expect(result.loadError).toBeUndefined();
    expect(result.data).toHaveLength(1);
  });

  it("still shows the friendly load error (and logs details) for a real product_variants query failure", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return variantChain({ data: null, count: null, error: { code: "42501", message: "permission denied for table product_variants" } });
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const result = await listInventoryVariants();
    expect(result.loadError).toBe("Unable to load data. Please try again or contact the administrator.");
    expect(result.data).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("product_variants query failed"),
      expect.objectContaining({ code: "42501" }),
    );
  });

  it("still shows the friendly load error for a real (non-column) product_images query failure", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "product_variants") {
        return variantChain({ data: variantRows, count: 1, error: null });
      }
      if (table === "product_images") {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: null,
                  error: { code: "42501", message: "permission denied for table product_images" },
                }),
            }),
          }),
        };
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const result = await listInventoryVariants();
    expect(result.loadError).toBe("Unable to load data. Please try again or contact the administrator.");
    expect(result.data).toHaveLength(0);
  });
});
