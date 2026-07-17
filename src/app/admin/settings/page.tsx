import { SettingsForm } from "@/components/settings/settings-form";
import { ExchangeRateSettings } from "@/components/settings/exchange-rate-settings";
import { getSettings } from "@/lib/services/settings.service";
import { getCurrentExchangeRate } from "@/lib/services/exchange-rate.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageExchangeRates } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const [settings, auth] = await Promise.all([getSettings(), getCurrentAuthState()]);
  const role = auth.profile?.role ?? null;
  const canManageRates = canManageExchangeRates(role);

  let currentRate = null;
  let updatedByName: string | null = null;
  if (canManageRates) {
    currentRate = await getCurrentExchangeRate("INR");
    if (currentRate?.updated_by) {
      const supabase = await createSupabaseServerClient();
      const { data: profile } = (await supabase
        ?.from("profiles")
        .select("full_name")
        .eq("id", currentRate.updated_by)
        .maybeSingle()) ?? { data: null };
      updatedByName = profile?.full_name ?? null;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Business settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure Musiva identity, print text, delivery defaults, and receipt settings.
        </p>
      </header>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground shadow-soft">
          Settings could not be loaded. Check Supabase configuration and migrations.
        </div>
      )}

      {canManageRates && (
        <ExchangeRateSettings currentRate={currentRate} updatedByName={updatedByName} />
      )}
    </div>
  );
}
