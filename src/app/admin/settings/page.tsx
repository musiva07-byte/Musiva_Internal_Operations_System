import { SettingsForm } from "@/components/settings/settings-form";
import { getSettings } from "@/lib/services/settings.service";

export default async function SettingsPage() {
  const settings = await getSettings();

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
    </div>
  );
}
