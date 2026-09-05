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
import { StickyActionBar } from "@/components/layout/sticky-action-bar";
import { SuccessDialog } from "@/components/layout/success-dialog";
import { createStaffAction } from "@/app/admin/staff/actions";
import { STAFF_ROLES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import { staffSchema, type StaffInput } from "@/lib/validations/staff.schema";

const roleOptions = [
  STAFF_ROLES.owner,
  STAFF_ROLES.manager,
  STAFF_ROLES.salesStaff,
  STAFF_ROLES.inventoryStaff,
  STAFF_ROLES.accountant,
  STAFF_ROLES.deliveryCoordinator,
];

export function StaffForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; role: string } | null>(null);
  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema) as Resolver<StaffInput>,
    defaultValues: {
      fullName: "",
      email: "",
      phone: null,
      role: STAFF_ROLES.salesStaff,
      password: "",
    },
  });

  function onSubmit(values: StaffInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createStaffAction(values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Staff user could not be created.");
        return;
      }
      setSaved({ id: result.id, name: values.fullName, role: values.role });
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Staff account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Full name">
            <Input {...form.register("fullName")} />
          </Field>
          <Field label="Email">
            <Input autoComplete="email" type="email" {...form.register("email")} />
          </Field>
          <Field label="Phone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Role">
            <Select {...form.register("role")}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {titleize(role)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Temporary password">
            <Input autoComplete="new-password" type="password" {...form.register("password")} />
          </Field>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <StickyActionBar className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Creating..." : "Create staff user"}
        </Button>
      </StickyActionBar>

      {saved && (
        <SuccessDialog
          open={saved !== null}
          onOpenChange={(open) => !open && router.push(`/admin/staff/${saved.id}`)}
          title="Staff user created successfully"
          description={saved.name}
          stats={[{ label: "Role", value: titleize(saved.role) }]}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/staff")}>
                Back to staff
              </Button>
              <Button type="button" onClick={() => router.push(`/admin/staff/${saved.id}`)}>
                View staff profile
              </Button>
            </>
          }
        />
      )}
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
