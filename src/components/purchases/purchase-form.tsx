"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseAction } from "@/app/admin/purchases/actions";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase.schema";
import type { PurchasableVariantItem } from "@/types/app";
import type { SupplierRow } from "@/types/database";

type PurchaseFormProps = {
  suppliers: SupplierRow[];
  variants: PurchasableVariantItem[];
};

const defaultItem = {
  productVariantId: "",
  quantityOrdered: 1,
  quantityReceived: 0,
  costPrice: 0,
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseForm({ suppliers, variants }: PurchaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema) as Resolver<PurchaseInput>,
    defaultValues: {
      supplierId: "",
      purchaseDate: todayInputValue(),
      expectedArrivalDate: null,
      status: PURCHASE_STATUSES.ordered,
      paymentStatus: PURCHASE_PAYMENT_STATUSES.unpaid,
      discount: 0,
      shippingCost: 0,
      notes: null,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const discount = useWatch({ control: form.control, name: "discount" });
  const shippingCost = useWatch({ control: form.control, name: "shippingCost" });
  const totals = useMemo(() => {
    const subtotal = (watchedItems ?? []).reduce(
      (sum, item) => sum + Number(item.quantityOrdered || 0) * Number(item.costPrice || 0),
      0,
    );
    return {
      subtotal,
      grandTotal: Math.max(0, subtotal - Number(discount || 0) + Number(shippingCost || 0)),
    };
  }, [discount, shippingCost, watchedItems]);

  function onSubmit(values: PurchaseInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createPurchaseAction(values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Purchase could not be created.");
        return;
      }
      router.push(`/admin/purchases/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Supplier">
            <Select {...form.register("supplierId")}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purchase date">
            <Input type="date" {...form.register("purchaseDate")} />
          </Field>
          <Field label="Expected arrival">
            <Input type="date" {...form.register("expectedArrivalDate")} />
          </Field>
          <Field label="Status">
            <Select {...form.register("status")}>
              {[PURCHASE_STATUSES.draft, PURCHASE_STATUSES.ordered].map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select {...form.register("paymentStatus")}>
              {Object.values(PURCHASE_PAYMENT_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Discount">
            <Input step="0.001" type="number" {...form.register("discount")} />
          </Field>
          <Field label="Shipping cost">
            <Input step="0.001" type="number" {...form.register("shippingCost")} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Items</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Received quantities are applied to inventory only when the purchase is marked received.
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
                <Select {...form.register(`items.${index}.productVariantId`)}>
                  <option value="">Select variant</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product_name} - {variant.color}/{variant.size} - {variant.variant_sku}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label="Ordered">
                <Input min={1} type="number" {...form.register(`items.${index}.quantityOrdered`)} />
              </Field>
              <Field label="Received">
                <Input min={0} type="number" {...form.register(`items.${index}.quantityReceived`)} />
              </Field>
              <Field label="Cost">
                <Input min={0} step="0.001" type="number" {...form.register(`items.${index}.costPrice`)} />
              </Field>
              <div className="flex items-end lg:col-start-6">
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
        <CardContent className="grid gap-3 pt-6 text-sm md:grid-cols-2">
          <div className="flex justify-between rounded-md bg-musiva-ivory p-3">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-musiva-plum">{formatBhd(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between rounded-md bg-musiva-ivory p-3">
            <span className="text-muted-foreground">Grand total</span>
            <span className="font-medium text-musiva-plum">{formatBhd(totals.grandTotal)}</span>
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save purchase"}
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
