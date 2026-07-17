import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageExchangeRates } from "@/lib/auth/permissions";
import { exchangeRateSchema, type ExchangeRateInput } from "@/lib/validations/exchange-rate.schema";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ExchangeRateRow } from "@/types/database";

// ── adapter interface ─────────────────────────────────────────────────────────
// Connect a live-rate provider by implementing this interface and calling
// setExchangeRateAdapter() at server startup (e.g. in a route handler or
// server action). The adapter must never be called from the browser.
// Not wired up anywhere yet — Settings → Exchange Rates is manual entry only.

export interface ExchangeRateAdapter {
  fetchRate(quoteCurrency: string, baseCurrency: string, date?: Date): Promise<number | null>;
}

const noopAdapter: ExchangeRateAdapter = {
  fetchRate: async () => null,
};

let adapter: ExchangeRateAdapter = noopAdapter;

export function setExchangeRateAdapter(impl: ExchangeRateAdapter): void {
  adapter = impl;
}

// ── server-side auto lookup ───────────────────────────────────────────────────
// Never called from the browser — returns null safely when unavailable.

export async function fetchAdapterRate(
  quoteCurrency: string,
  baseCurrency = "BHD",
): Promise<{ rate: number | null; source: string }> {
  if (typeof window !== "undefined") {
    return { rate: null, source: "unavailable" };
  }
  try {
    const rate = await adapter.fetchRate(quoteCurrency, baseCurrency);
    return { rate, source: rate !== null ? "auto" : "unavailable" };
  } catch {
    return { rate: null, source: "unavailable" };
  }
}

// ── current rate (Settings → Exchange Rates) ──────────────────────────────────
// rate = 1 unit of quoteCurrency expressed in BHD (multiply direction), matching
// lib/utils/cost-conversion.ts. This is the value the New Product wizard auto-fills.

/** The single active rate for a currency pair, or null if none has been set yet. */
export async function getCurrentExchangeRate(
  quoteCurrency = "INR",
  baseCurrency = "BHD",
): Promise<ExchangeRateRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

/**
 * Sets a new current rate for a currency pair. Atomic (single RPC call): deactivates
 * any existing active row for the pair, then inserts the new one as active. Owner/manager
 * only — enforced both here (defense in depth) and inside the RPC itself.
 * Setting a new rate never changes historical costs already saved on past products/batches.
 */
export async function setCurrentExchangeRate(
  input: ExchangeRateInput,
): Promise<ServiceResult<ExchangeRateRow>> {
  const parsed = exchangeRateSchema.safeParse(input);
  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canManageExchangeRates, "manage exchange rates");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.rpc("set_exchange_rate", {
    p_quote_currency: parsed.data.quoteCurrency,
    p_rate: parsed.data.rate,
    p_effective_date: parsed.data.effectiveDate,
    p_source: parsed.data.source,
  });

  if (error || !data) {
    return serviceError("Exchange rate could not be saved.");
  }

  return serviceSuccess(data);
}
