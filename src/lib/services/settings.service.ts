import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canUpdateSettings } from "@/lib/auth/permissions";
import { settingsSchema, type SettingsInput } from "@/lib/validations/settings.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { SettingsRow } from "@/types/database";

async function validateSettingsUser() {
  return requireStaffPermission(canUpdateSettings, "update settings");
}

const defaultSettings = {
  business_name: "Moosiva Lux Wear",
  logo_url: null,
  logo_path: null,
  whatsapp_number: null,
  instagram_handle: null,
  business_address: null,
  invoice_footer: "Thank you for shopping with Moosiva Lux Wear.",
  return_policy_text: "Exchange is subject to boutique policy and item condition.",
  default_delivery_charge: 0,
  currency: "BHD",
  low_stock_default_quantity: 3,
  receipt_theme: "premium_light",
};

export async function getSettings(): Promise<SettingsRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: existing } = await supabase
    .from("settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data } = await supabase.from("settings").insert(defaultSettings).select().single();
  return data ?? null;
}

export async function updateSettings(input: SettingsInput): Promise<ServiceResult<SettingsRow>> {
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateSettingsUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const existing = await getSettings();
  if (!existing) {
    return serviceError("Settings could not be loaded.");
  }

  const settingsInput = parsed.data;
  const { data, error } = await auth.supabase
    .from("settings")
    .update({
      business_name: settingsInput.businessName,
      logo_url: settingsInput.logoUrl ?? null,
      logo_path: settingsInput.logoPath ?? null,
      whatsapp_number: settingsInput.whatsappNumber ?? null,
      instagram_handle: settingsInput.instagramHandle ?? null,
      business_address: settingsInput.businessAddress ?? null,
      invoice_footer: settingsInput.invoiceFooter,
      return_policy_text: settingsInput.returnPolicyText,
      default_delivery_charge: settingsInput.defaultDeliveryCharge,
      currency: settingsInput.currency,
      low_stock_default_quantity: settingsInput.lowStockDefaultQuantity,
      receipt_theme: settingsInput.receiptTheme,
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Settings could not be updated.");
  }

  await createAuditLog({
    action: "update_settings",
    tableName: "settings",
    recordId: data.id,
    userId: auth.userId,
    metadata: {
      business_name: data.business_name,
      currency: data.currency,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/print/invoice");
  revalidatePath("/print/combined");
  return serviceSuccess(data);
}
