/**
 * Tests for the Previous/Next detail-page navigation helpers added alongside the shared
 * PreviousNextNav component: getAdjacentProducts (product.service.ts) and getAdjacentCustomers
 * (customer.service.ts). Both mirror the existing getAdjacentOrders pattern in
 * order.service.ts — two queries (older/newer by created_at), each capped to 1 row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

import { getAdjacentProducts } from "./product.service";
import { getAdjacentCustomers } from "./customer.service";

function chainResolveAll(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (..._args: unknown[]) => proxy;
      },
    },
  );
  return proxy;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getAdjacentProducts", () => {
  it("returns previous and next products when both exist", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "p-prev", name: "Older Dress" }], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "p-next", name: "Newer Dress" }], error: null }));

    const result = await getAdjacentProducts("p-current", "2026-01-01T00:00:00Z");

    expect(result.previous).toEqual({ id: "p-prev", name: "Older Dress" });
    expect(result.next).toEqual({ id: "p-next", name: "Newer Dress" });
    expect(mockFrom).toHaveBeenCalledWith("products");
  });

  it("returns nulls when there is no adjacent product on either side", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    const result = await getAdjacentProducts("p-only", "2026-01-01T00:00:00Z");

    expect(result).toEqual({ previous: null, next: null });
  });
});

describe("getAdjacentCustomers", () => {
  it("returns previous and next customers when both exist", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "c-prev", full_name: "Aisha" }], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [{ id: "c-next", full_name: "Zainab" }], error: null }));

    const result = await getAdjacentCustomers("c-current", "2026-01-01T00:00:00Z");

    expect(result.previous).toEqual({ id: "c-prev", full_name: "Aisha" });
    expect(result.next).toEqual({ id: "c-next", full_name: "Zainab" });
    expect(mockFrom).toHaveBeenCalledWith("customers");
  });

  it("returns nulls when there is no adjacent customer on either side", async () => {
    mockFrom
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }))
      .mockReturnValueOnce(chainResolveAll({ data: [], error: null }));

    const result = await getAdjacentCustomers("c-only", "2026-01-01T00:00:00Z");

    expect(result).toEqual({ previous: null, next: null });
  });
});
