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
import {
  RETURN_CONDITIONS,
  RETURN_ITEM_ACTIONS,
  RETURN_REASONS,
  RETURN_STATUSES,
  RETURN_TYPES,
} from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { returnSchema, type ReturnInput } from "@/lib/validations/return.schema";
import { createReturnAction } from "@/app/admin/returns/actions";
import type { CustomerRow, OrderItemRow, OrderRow } from "@/types/database";

type ReturnFormProps = {
  orders: Array<OrderRow & { customers?: Pick<CustomerRow, "full_name" | "mobile"> | null }>;
  orderItems: OrderItemRow[];
};

const defaultItem = {
  productVariantId: "",
  quantity: 1,
  action: RETURN_ITEM_ACTIONS.addBackToStock,
};

export function ReturnForm({ orders, orderItems }: ReturnFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ReturnInput>({
    resolver: zodResolver(returnSchema) as Resolver<ReturnInput>,
    defaultValues: {
      originalOrderId: "",
      returnType: RETURN_TYPES.return,
      reason: RETURN_REASONS.sizeIssue,
      condition: RETURN_CONDITIONS.sellable,
      refundAmount: 0,
      exchangeOrderId: null,
      status: RETURN_STATUSES.completed,
      notes: null,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const selectedOrderId = useWatch({ control: form.control, name: "originalOrderId" });
  const selectedItems = useMemo(
    () => orderItems.filter((item) => item.order_id === selectedOrderId),
    [orderItems, selectedOrderId],
  );

  function onSubmit(values: ReturnInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createReturnAction(values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Return could not be created.");
        return;
      }
      router.push(`/admin/returns/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Return details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Original order">
            <Select {...form.register("originalOrderId")}>
              <option value="">Select order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.order_number} - {order.customers?.full_name ?? "Customer"} - {formatBhd(order.grand_total)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select {...form.register("returnType")}>
              {Object.values(RETURN_TYPES).map((type) => (
                <option key={type} value={type}>
                  {titleize(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason">
            <Select {...form.register("reason")}>
              {Object.values(RETURN_REASONS).map((reason) => (
                <option key={reason} value={reason}>
                  {titleize(reason)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition">
            <Select {...form.register("condition")}>
              {Object.values(RETURN_CONDITIONS).map((condition) => (
                <option key={condition} value={condition}>
                  {titleize(condition)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Refund amount">
            <Input step="0.001" type="number" {...form.register("refundAmount")} />
          </Field>
          <Field label="Status">
            <Select {...form.register("status")}>
              {Object.values(RETURN_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
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
            <CardTitle>Returned items</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Sellable items add stock back. Damaged items create a damaged movement without increasing sellable stock.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => append(defaultItem)}>
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 rounded-md border bg-musiva-ivory p-4 lg:grid-cols-5">
              <div className="space-y-2 lg:col-span-2">
                <Label>Original item</Label>
                <Select {...form.register(`items.${index}.productVariantId`)}>
                  <option value="">Select item</option>
                  {selectedItems.map((item) => (
                    <option key={item.id} value={item.product_variant_id}>
                      {item.product_name_snapshot} - {item.color_snapshot}/{item.size_snapshot} - sold {item.quantity}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label="Quantity">
                <Input min={1} type="number" {...form.register(`items.${index}.quantity`)} />
              </Field>
              <Field label="Action">
                <Select {...form.register(`items.${index}.action`)}>
                  {Object.values(RETURN_ITEM_ACTIONS).map((action) => (
                    <option key={action} value={action}>
                      {titleize(action)}
                    </option>
                  ))}
                </Select>
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

      {formError ? <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Processing..." : "Process return"}
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
