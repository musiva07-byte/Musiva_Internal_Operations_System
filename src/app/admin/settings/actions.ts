"use server";

import { updateSettings } from "@/lib/services/settings.service";
import type { SettingsInput } from "@/lib/validations/settings.schema";

export async function updateSettingsAction(input: SettingsInput) {
  const result = await updateSettings(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, error: null };
}
