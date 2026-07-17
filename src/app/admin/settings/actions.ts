"use server";

import { updateSettings } from "@/lib/services/settings.service";
import { setCurrentExchangeRate } from "@/lib/services/exchange-rate.service";
import type { SettingsInput } from "@/lib/validations/settings.schema";
import type { ExchangeRateInput } from "@/lib/validations/exchange-rate.schema";

export async function updateSettingsAction(input: SettingsInput) {
  const result = await updateSettings(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}

export async function setExchangeRateAction(input: ExchangeRateInput) {
  const result = await setCurrentExchangeRate(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}
