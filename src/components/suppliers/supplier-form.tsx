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
import { createSupplierAction, updateSupplierAction } from "@/app/admin/suppliers/actions";
import { supplierSchema, type SupplierInput } from "@/lib/validations/supplier.schema";
import type { SupplierRow } from "@/types/database";

type SupplierFormProps = {
  supplier?: SupplierRow;
};

export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema) as Resolver<SupplierInput>,
    defaultValues: {
      supplierName: supplier?.supplier_name ?? "",
      contactPerson: supplier?.contact_person ?? null,
      phone: supplier?.phone ?? null,
      email: supplier?.email ?? null,
      country: supplier?.country ?? "Bahrain",
      address: supplier?.address ?? null,
      notes: supplier?.notes ?? null,
    },
  });

  function onSubmit(values: SupplierInput) {
    setFormError(null);
    startTransition(async () => {
      const result = supplier
        ? await updateSupplierAction(supplier.id, values)
        : await createSupplierAction(values);

      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Supplier could not be saved.");
        return;
      }

      router.push(`/admin/suppliers/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Supplier details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Supplier name">
            <Input {...form.register("supplierName")} />
          </Field>
          <Field label="Contact person">
            <Input {...form.register("contactPerson")} />
          </Field>
          <Field label="Phone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Email">
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Country">
            <Input {...form.register("country")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Textarea {...form.register("address")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} />
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save supplier"}
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
