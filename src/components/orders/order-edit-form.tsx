"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import { updateOrderSchema, type UpdateOrderInput } from "@/lib/validations/order.schema";
import { updateOrderAction } from "@/app/admin/orders/actions";
import type { OrderRow } from "@/types/database";

export function OrderEditForm({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<UpdateOrderInput>({
    resolver: zodResolver(updateOrderSchema) as Resolver<UpdateOrderInput>,
    defaultValues: {
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      amountPaid: Number(order.amount_paid),
      notes: order.notes,
    },
  });

  function onSubmit(values: UpdateOrderInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await updateOrderAction(order.id, values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Order could not be updated.");
        return;
      }
      router.push(`/admin/orders/${order.id}`);
      router.refresh();
    });
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Order status">
            <Select {...form.register("orderStatus")}>
              {Object.values(ORDER_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select {...form.register("paymentStatus")}>
              {Object.values(PAYMENT_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
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
          <Field label="Amount paid">
            <Input step="0.001" type="number" {...form.register("amountPaid")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} />
          </div>
          {formError ? <p className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
          <div className="flex justify-end gap-3 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
