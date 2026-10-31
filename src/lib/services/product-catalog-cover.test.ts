/**
 * Product Catalog's listing image: the staff-chosen cover, whichever photo that is. Products
 * without one (color photos uploaded before covers existed) still get a usable image.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockCreateClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

import { listProducts } from "./product.service";

const base = "https://x.supabase.co/storage/v1/object/public/product-images";

type ImageRow = { product_id: string; url: string; color: string | null; is_primary: boolean };

function chainResolving(resolver: (filters: Record<string, unknown>) => unknown) {
  const filters: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolver(filters)).then(onFulfilled);
        }
        return (...args: unknown[]) => {
          if (prop === "eq" || prop === "in") filters[args[0] as string] = args[1];
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function mockCatalog(productIds: string[], images: ImageRow[]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "products") {
      const rows = productIds.map((id) => ({ id, name: id, sku: id, slug: id, status: "active", categories: null }));
      return chainResolving(() => ({ data: rows, count: rows.length, error: null }));
    }
    if (table === "product_images") {
      return chainResolving((filters) => ({
        data: images.filter(
          (image) =>
            (filters.product_id as string[]).includes(image.product_id) &&
            (filters.is_primary === undefined || image.is_primary === filters.is_primary),
        ),
        error: null,
      }));
    }
    return chainResolving(() => ({ data: [], error: null }));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom });
});

describe("listProducts — cover image", () => {
  it("shows the chosen color photo as the cover, not the legacy main image", async () => {
    mockCatalog(["p1"], [
      { product_id: "p1", url: `${base}/main.jpg`, color: null, is_primary: false },
      { product_id: "p1", url: `${base}/brown.jpg`, color: "BROWN", is_primary: true },
      { product_id: "p1", url: `${base}/cream.jpg`, color: "CREAM", is_primary: false },
    ]);
    const result = await listProducts({});
    expect(result.data[0].primary_image_url).toBe(`${base}/brown.jpg`);
  });

  it("keeps showing the main image of a legacy product", async () => {
    mockCatalog(["p1"], [{ product_id: "p1", url: `${base}/main.jpg`, color: null, is_primary: true }]);
    const result = await listProducts({});
    expect(result.data[0].primary_image_url).toBe(`${base}/main.jpg`);
  });

  it("still shows a photo for a product whose color photos have no cover set", async () => {
    mockCatalog(["p1"], [
      { product_id: "p1", url: `${base}/cream.jpg`, color: "CREAM", is_primary: false },
      { product_id: "p1", url: `${base}/brown.jpg`, color: "BROWN", is_primary: false },
    ]);
    const result = await listProducts({});
    expect(result.data[0].primary_image_url).toBe(`${base}/brown.jpg`);
  });

  it("gives each product its own cover and no image to a product without photos", async () => {
    mockCatalog(["p1", "p2", "p3"], [
      { product_id: "p1", url: `${base}/one.jpg`, color: "BLACK", is_primary: true },
      { product_id: "p2", url: `${base}/two.jpg`, color: null, is_primary: true },
    ]);
    const result = await listProducts({});
    expect(result.data.map((product) => product.primary_image_url)).toEqual([`${base}/one.jpg`, `${base}/two.jpg`, null]);
  });
});
