/**
 * Test for the New Sale product search Server Action — a thin wrapper over
 * listOrderableVariants({ q }), which is where the real fix lives (see
 * order-product-search.test.ts). This just confirms the action passes the query through.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListOrderableVariants } = vi.hoisted(() => ({
  mockListOrderableVariants: vi.fn(),
}));

vi.mock("@/lib/services/order.service", () => ({
  listOrderableVariants: mockListOrderableVariants,
}));

import { searchOrderableVariantsAction } from "./product-search-action";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchOrderableVariantsAction", () => {
  it("passes the typed query through to listOrderableVariants, defaulting includeOutOfStock to false", async () => {
    mockListOrderableVariants.mockResolvedValue([{ id: "variant-1" }]);

    const result = await searchOrderableVariantsAction("39");

    expect(mockListOrderableVariants).toHaveBeenCalledWith({ q: "39", includeOutOfStock: false });
    expect(result).toEqual([{ id: "variant-1" }]);
  });

  it("passes includeOutOfStock through when the 'Show out-of-stock too' toggle is on", async () => {
    mockListOrderableVariants.mockResolvedValue([]);

    await searchOrderableVariantsAction("39", true);

    expect(mockListOrderableVariants).toHaveBeenCalledWith({ q: "39", includeOutOfStock: true });
  });
});
