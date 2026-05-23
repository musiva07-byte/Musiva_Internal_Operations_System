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
import { createExpenseAction } from "@/app/admin/expenses/actions";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import { expenseSchema, type ExpenseInput } from "@/lib/validations/expense.schema";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseInput>,
    defaultValues: {
      category: EXPENSE_CATEGORIES.miscellaneous,
      amount: 0,
      expenseDate: todayInputValue(),
      paymentMethod: PAYMENT_METHODS.cash,
      vendor: null,
      notes: null,
      attachmentUrl: null,
    },
  });

  function onSubmit(values: ExpenseInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createExpenseAction(values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Expense could not be created.");
        return;
      }
      router.push(`/admin/expenses/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Expense details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Category">
            <Select {...form.register("category")}>
              {Object.values(EXPENSE_CATEGORIES).map((category) => (
                <option key={category} value={category}>
                  {titleize(category)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount">
            <Input min={0} step="0.001" type="number" {...form.register("amount")} />
          </Field>
          <Field label="Expense date">
            <Input type="date" {...form.register("expenseDate")} />
          </Field>
          <Field label="Payment method">
            <Select {...form.register("paymentMethod")}>
              {Object.values(PAYMENT_METHODS).map((method) => (
                <option key={method} value={method}>
                  {titleize(method)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vendor">
            <Input {...form.register("vendor")} />
          </Field>
          <Field label="Attachment URL">
            <Input type="url" {...form.register("attachmentUrl")} />
          </Field>
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
          {isPending ? "Saving..." : "Save expense"}
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
