"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BAHRAIN_GOVERNORATES,
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { createOrderSchema, type CreateOrderInput } from "@/lib/validations/order.schema";
import { createOrderAction } from "@/app/admin/orders/actions";
import type { OrderableVariantItem } from "@/types/app";

type OrderFormProps = {
  variants: OrderableVariantItem[];
};

const defaultItem = {
  productVariantId: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
};

export function OrderForm({ variants }: OrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateOrderInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createOrderSchema) as any,
    defaultValues: {
      customerId: null,
      customer: {
        fullName: "",
        mobile: "",
        whatsapp: null,
        email: null,
        governorate: null,
        area: null,
        block: null,
        road: null,
        building: null,
        flat: null,
        landmark: null,
        deliveryNotes: null,
      },
      orderSource: ORDER_SOURCES.whatsapp,
      orderStatus: ORDER_STATUSES.new,
      paymentStatus: PAYMENT_STATUSES.unpaid,
      paymentMethod: PAYMENT_METHODS.benefitPay,
      fulfilmentMethod: "delivery" as const,
      deliveryAddress: null,
      deliveryDate: null,
      deliveryTimeSlot: null,
      deliveryCharge: 0,
      amountPaid: 0,
      notes: null,
      paymentReference: null,
      paymentNote: null,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: "items", defaultValue: [defaultItem] });
  const watchedDeliveryCharge = Number(useWatch({ control: form.control, name: "deliveryCharge" }) ?? 0);
  const watchedAmountPaid = Number(useWatch({ control: form.control, name: "amountPaid" }) ?? 0);
  const subtotal = watchedItems.reduce((sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0);
  const discount = watchedItems.reduce((sum, item) => sum + Number(item.discount ?? 0), 0);
  const grandTotal = Math.max(0, subtotal - discount + watchedDeliveryCharge);
  const amountDue = Math.max(0, grandTotal - watchedAmountPaid);

  function applyVariantPrice(index: number, variantId: string) {
    const variant = variants.find((item) => item.id === variantId);
    if (!variant) {
      return;
    }
    form.setValue(`items.${index}.unitPrice`, Number(variant.discount_price ?? variant.selling_price));
  }

  function onSubmit(values: CreateOrderInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createOrderAction(values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Order could not be created.");
        return;
      }
      router.push(`/admin/orders/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Customer and Bahrain delivery details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Customer name" error={form.formState.errors.customer?.fullName?.message}>
            <Input {...form.register("customer.fullName")} />
          </Field>
          <Field label="Mobile" error={form.formState.errors.customer?.mobile?.message}>
            <Input {...form.register("customer.mobile")} placeholder="+973 XXXX XXXX" />
          </Field>
          <Field label="WhatsApp">
            <Input {...form.register("customer.whatsapp")} />
          </Field>
          <Field label="Email">
            <Input type="email" {...form.register("customer.email")} />
          </Field>
          <Field label="Governorate">
            <Select {...form.register("customer.governorate")}>
              <option value="">Select governorate</option>
              {BAHRAIN_GOVERNORATES.map((governorate) => (
                <option key={governorate} value={governorate}>
                  {governorate}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Input {...form.register("customer.area")} />
          </Field>
          <Field label="Block">
            <Input {...form.register("customer.block")} />
          </Field>
          <Field label="Road">
            <Input {...form.register("customer.road")} />
          </Field>
          <Field label="Building">
            <Input {...form.register("customer.building")} />
          </Field>
          <Field label="Flat / Apartment">
            <Input {...form.register("customer.flat")} />
          </Field>
          <Field label="Landmark">
            <Input {...form.register("customer.landmark")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Delivery notes</Label>
            <Textarea {...form.register("customer.deliveryNotes")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order items</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Stock is checked and deducted on the server when the order is created.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => append(defaultItem)}>
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 rounded-md border bg-musiva-ivory p-4 lg:grid-cols-6">
              <div className="space-y-2 lg:col-span-3">
                <Label>Product variant</Label>
                <Select
                  {...form.register(`items.${index}.productVariantId`)}
                  onChange={(event) => {
                    form.setValue(`items.${index}.productVariantId`, event.target.value);
                    applyVariantPrice(index, event.target.value);
                  }}
                >
                  <option value="">Select variant</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product_name} - {variant.color} / {variant.size} - stock {variant.stock_quantity}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label="Qty">
                <Input min={1} type="number" {...form.register(`items.${index}.quantity`)} />
              </Field>
              <Field label="Unit price">
                <Input step="0.001" type="number" {...form.register(`items.${index}.unitPrice`)} />
              </Field>
              <Field label="Discount">
                <Input step="0.001" type="number" {...form.register(`items.${index}.discount`)} />
              </Field>
              <div className="flex items-end">
                <Button disabled={fields.length === 1} type="button" variant="outline" onClick={() => remove(index)}>
                  <Trash2 aria-hidden className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Order, payment, and delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Order source">
            <Select {...form.register("orderSource")}>
              {Object.values(ORDER_SOURCES).map((source) => (
                <option key={source} value={source}>
                  {titleize(source)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Order status">
            <Select {...form.register("orderStatus")}>
              {Object.values(ORDER_STATUSES).map((status) => (
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
          <Field label="Payment status">
            <Select {...form.register("paymentStatus")}>
              {Object.values(PAYMENT_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Delivery charge">
            <Input step="0.001" type="number" {...form.register("deliveryCharge")} />
          </Field>
          <Field label="Amount paid">
            <Input step="0.001" type="number" {...form.register("amountPaid")} />
          </Field>
          <Field label="Delivery date">
            <Input type="date" {...form.register("deliveryDate")} />
          </Field>
          <Field label="Delivery time slot">
            <Input {...form.register("deliveryTimeSlot")} placeholder="4:00 PM - 7:00 PM" />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Order notes</Label>
            <Textarea {...form.register("notes")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="grid gap-3 pt-6 text-sm md:grid-cols-4">
          <Summary label="Subtotal" value={formatBhd(subtotal)} />
          <Summary label="Discounts" value={formatBhd(discount)} />
          <Summary label="Grand total" value={formatBhd(grandTotal)} />
          <Summary label="Amount due" value={formatBhd(amountDue)} />
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Creating..." : "Create order"}
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-musiva-ivory p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-musiva-plum">{value}</p>
    </div>
  );
}
