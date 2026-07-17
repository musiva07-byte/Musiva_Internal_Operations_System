/**
 * Tests for exchange-rate.service.ts — Settings → Exchange Rates.
 *
 * Covers:
 *  - current exchange rate loads (active row only)
 *  - setting a new rate requires owner/manager permission
 *  - setting a new rate never mutates historical batches (it only ever calls the
 *    set_exchange_rate RPC — it never touches product_variants/inventory_batches)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc, mockCreateClient, mockRequireStaffPermission } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockCreateClient: vi.fn(),
  mockRequireStaffPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: mockRequireStaffPermission,
}));

import { getCurrentExchangeRate, setCurrentExchangeRate } from "./exchange-rate.service";

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

const activeRateRow = {
  id: "rate-1",
  base_currency: "BHD",
  quote_currency: "INR",
  rate: 0.00452,
  rate_date: "2026-07-08",
  source: "manual",
  is_manual: true,
  is_active: true,
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-07-08T00:00:00.000Z",
  updated_at: "2026-07-08T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockFrom, rpc: mockRpc });
  mockFrom.mockReturnValue(chainResolveAll({ data: null, error: null }));
});

describe("getCurrentExchangeRate", () => {
  it("returns the active row for the currency pair", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: activeRateRow, error: null }));

    const result = await getCurrentExchangeRate("INR");

    expect(result).toEqual(activeRateRow);
  });

  it("returns null when no active rate exists yet", async () => {
    mockFrom.mockReturnValue(chainResolveAll({ data: null, error: null }));

    const result = await getCurrentExchangeRate("INR");

    expect(result).toBeNull();
  });

  it("returns null when Supabase is not configured", async () => {
    mockCreateClient.mockResolvedValue(null);

    const result = await getCurrentExchangeRate("INR");

    expect(result).toBeNull();
  });
});

describe("setCurrentExchangeRate", () => {
  it("rejects an invalid rate before touching auth or the database", async () => {
    const result = await setCurrentExchangeRate({
      quoteCurrency: "INR",
      rate: 0,
      effectiveDate: "2026-07-08",
      source: "manual",
    });

    expect(result.error).toBeTruthy();
    expect(mockRequireStaffPermission).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the user lacks permission", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: null,
      userId: null,
      role: null,
      error: "You do not have permission to perform this action.",
    });

    const result = await setCurrentExchangeRate({
      quoteCurrency: "INR",
      rate: 0.0045,
      effectiveDate: "2026-07-08",
      source: "manual",
    });

    expect(result.error).toBe("You do not have permission to perform this action.");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls set_exchange_rate RPC with the parsed input for an authorized user", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom, rpc: mockRpc },
      userId: "user-1",
      role: "manager",
      error: null,
    });
    mockRpc.mockReturnValue(chainResolveAll({ data: activeRateRow, error: null }));

    const result = await setCurrentExchangeRate({
      quoteCurrency: "INR",
      rate: 0.00452,
      effectiveDate: "2026-07-08",
      source: "manual",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(activeRateRow);
    expect(mockRpc).toHaveBeenCalledWith("set_exchange_rate", {
      p_quote_currency: "INR",
      p_rate: 0.00452,
      p_effective_date: "2026-07-08",
      p_source: "manual",
    });
  });

  it("only ever calls the RPC — never touches product_variants or inventory_batches directly", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom, rpc: mockRpc },
      userId: "user-1",
      role: "owner",
      error: null,
    });
    mockRpc.mockReturnValue(chainResolveAll({ data: activeRateRow, error: null }));

    await setCurrentExchangeRate({
      quoteCurrency: "INR",
      rate: 0.0046,
      effectiveDate: "2026-01-15",
      source: "bank",
    });

    // Setting a new "current" rate must never reach into historical cost tables —
    // old products/batches keep whatever rate they already saved.
    expect(mockFrom).not.toHaveBeenCalledWith("product_variants");
    expect(mockFrom).not.toHaveBeenCalledWith("inventory_batches");
  });

  it("returns a friendly error, never a raw Supabase error, when the RPC fails", async () => {
    mockRequireStaffPermission.mockResolvedValue({
      supabase: { from: mockFrom, rpc: mockRpc },
      userId: "user-1",
      role: "owner",
      error: null,
    });
    mockRpc.mockReturnValue(chainResolveAll({ data: null, error: { message: "constraint violation xyz" } }));

    const result = await setCurrentExchangeRate({
      quoteCurrency: "INR",
      rate: 0.0046,
      effectiveDate: "2026-01-15",
      source: "manual",
    });

    expect(result.error).toBe("Exchange rate could not be saved.");
    expect(result.error).not.toContain("constraint violation");
  });
});
