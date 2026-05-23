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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BAHRAIN_GOVERNORATES } from "@/lib/constants";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer.schema";
import { createCustomerAction, updateCustomerAction } from "@/app/admin/customers/actions";
import type { CustomerRow } from "@/types/database";

type CustomerFormProps = {
  customer?: CustomerRow;
};

function mapCustomer(customer?: CustomerRow): CustomerInput {
  return {
    id: customer?.id,
    fullName: customer?.full_name ?? "",
    mobile: customer?.mobile ?? "",
    whatsapp: customer?.whatsapp ?? null,
    email: customer?.email ?? null,
    governorate: customer?.governorate as CustomerInput["governorate"],
    area: customer?.area ?? null,
    block: customer?.block ?? null,
    road: customer?.road ?? null,
    building: customer?.building ?? null,
    flat: customer?.flat ?? null,
    landmark: customer?.landmark ?? null,
    deliveryNotes: customer?.delivery_notes ?? null,
  };
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema) as Resolver<CustomerInput>,
    defaultValues: mapCustomer(customer),
  });

  function onSubmit(values: CustomerInput) {
    setFormError(null);
    startTransition(async () => {
      const result = customer
        ? await updateCustomerAction(customer.id, values)
        : await createCustomerAction(values);

      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Customer could not be saved.");
        return;
      }

      router.push(`/admin/customers/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Full name" error={form.formState.errors.fullName?.message}>
            <Input {...form.register("fullName")} placeholder="Customer name" />
          </Field>
          <Field label="Mobile" error={form.formState.errors.mobile?.message}>
            <Input {...form.register("mobile")} placeholder="+973 XXXX XXXX" />
          </Field>
          <Field label="WhatsApp">
            <Input {...form.register("whatsapp")} placeholder="+973 XXXX XXXX" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Bahrain delivery address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Governorate">
            <Select {...form.register("governorate")}>
              <option value="">Select governorate</option>
              {BAHRAIN_GOVERNORATES.map((governorate) => (
                <option key={governorate} value={governorate}>
                  {governorate}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Input {...form.register("area")} />
          </Field>
          <Field label="Block">
            <Input {...form.register("block")} />
          </Field>
          <Field label="Road">
            <Input {...form.register("road")} />
          </Field>
          <Field label="Building">
            <Input {...form.register("building")} />
          </Field>
          <Field label="Flat / Apartment">
            <Input {...form.register("flat")} />
          </Field>
          <Field label="Landmark">
            <Input {...form.register("landmark")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Delivery notes</Label>
            <Textarea {...form.register("deliveryNotes")} />
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save customer"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
