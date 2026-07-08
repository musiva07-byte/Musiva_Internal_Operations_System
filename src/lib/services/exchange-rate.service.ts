import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageExchangeRates } from "@/lib/auth/permissions";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ExchangeRateRow } from "@/types/database";

// ── adapter interface ─────────────────────────────────────────────────────────
// Connect a live-rate provider by implementing this interface and calling
// setExchangeRateAdapter() at server startup (e.g. in a route handler or
// server action). The adapter must never be called from the browser.

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

// ── database CRUD ─────────────────────────────────────────────────────────────

export type SaveRateInput = {
  baseCurrency?: string;
  quoteCurrency: string;
  rate: number;
  rateDate: string;
  source?: string;
  isManual?: boolean;
};

export async function saveExchangeRate(
  input: SaveRateInput,
): Promise<ServiceResult<ExchangeRateRow>> {
  const auth = await requireStaffPermission(canManageExchangeRates, "manage exchange rates");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase
    .from("exchange_rates")
    .insert({
      base_currency: input.baseCurrency ?? "BHD",
      quote_currency: input.quoteCurrency,
      rate: input.rate,
      rate_date: input.rateDate,
      source: input.source ?? "manual",
      is_manual: input.isManual ?? true,
    })
    .select()
    .single();

  if (error || !data) {
    return serviceError("Exchange rate could not be saved.");
  }

  return serviceSuccess(data);
}

export async function getLatestExchangeRate(
  quoteCurrency: string,
  baseCurrency = "BHD",
): Promise<ExchangeRateRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function listRecentRates(
  quoteCurrency: string,
  baseCurrency = "BHD",
  limit = 10,
): Promise<ExchangeRateRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("rate_date", { ascending: false })
    .limit(limit);

  return data ?? [];
}
