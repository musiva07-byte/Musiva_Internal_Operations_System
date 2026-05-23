"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSettingsAction } from "@/app/admin/settings/actions";
import { settingsSchema, type SettingsInput } from "@/lib/validations/settings.schema";
import type { SettingsRow } from "@/types/database";

type SettingsFormProps = {
  settings: SettingsRow;
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema) as Resolver<SettingsInput>,
    defaultValues: {
      businessName: settings.business_name,
      logoUrl: settings.logo_url,
      logoPath: settings.logo_path,
      whatsappNumber: settings.whatsapp_number,
      instagramHandle: settings.instagram_handle,
      businessAddress: settings.business_address,
      invoiceFooter: settings.invoice_footer,
      returnPolicyText: settings.return_policy_text,
      defaultDeliveryCharge: settings.default_delivery_charge,
      currency: settings.currency,
      lowStockDefaultQuantity: settings.low_stock_default_quantity,
      receiptTheme: settings.receipt_theme,
    },
  });

  function onSubmit(values: SettingsInput) {
    setFormError(null);
    setFormMessage(null);
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (!result.ok) {
        setFormError(result.error ?? "Settings could not be updated.");
        return;
      }
      setFormMessage("Settings updated.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Business identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Business name">
            <Input {...form.register("businessName")} />
          </Field>
          <Field label="Currency">
            <Input {...form.register("currency")} />
          </Field>
          <Field label="Logo URL">
            <Input type="url" {...form.register("logoUrl")} />
          </Field>
          <Field label="Logo storage path">
            <Input {...form.register("logoPath")} />
          </Field>
          <Field label="WhatsApp number">
            <Input {...form.register("whatsappNumber")} />
          </Field>
          <Field label="Instagram handle">
            <Input {...form.register("instagramHandle")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Business address</Label>
            <Textarea {...form.register("businessAddress")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Operations defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Default delivery charge">
            <Input min={0} step="0.001" type="number" {...form.register("defaultDeliveryCharge")} />
          </Field>
          <Field label="Low stock default quantity">
            <Input min={0} type="number" {...form.register("lowStockDefaultQuantity")} />
          </Field>
          <Field label="Receipt theme">
            <Input {...form.register("receiptTheme")} />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Print text</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="space-y-2">
            <Label>Invoice footer</Label>
            <Textarea {...form.register("invoiceFooter")} />
          </div>
          <div className="space-y-2">
            <Label>Return policy text</Label>
            <Textarea {...form.register("returnPolicyText")} />
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}
      {formMessage ? <p className="rounded-md border border-musiva-sage/20 bg-musiva-sage/5 p-3 text-sm text-musiva-sage">{formMessage}</p> : null}

      <div className="flex justify-end">
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
