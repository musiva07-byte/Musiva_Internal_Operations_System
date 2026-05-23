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
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { stockEntrySchema, type StockEntryInput } from "@/lib/validations/inventory.schema";
import { addStockAction } from "@/app/admin/inventory/actions";
import type { InventoryVariantItem } from "@/types/app";

type StockEntryFormProps = {
  variants: InventoryVariantItem[];
};

export function StockEntryForm({ variants }: StockEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<StockEntryInput>({
    resolver: zodResolver(stockEntrySchema) as Resolver<StockEntryInput>,
    defaultValues: {
      productVariantId: "",
      quantity: 1,
      movementType: STOCK_MOVEMENT_TYPES.openingStock,
      referenceType: null,
      referenceId: null,
      note: null,
    },
  });

  function onSubmit(values: StockEntryInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await addStockAction(values);
      if (!result.ok) {
        setFormError(result.error ?? "Stock could not be added.");
        return;
      }
      router.push("/admin/inventory/movements");
      router.refresh();
    });
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2 md:col-span-2">
            <Label>Variant</Label>
            <Select {...form.register("productVariantId")}>
              <option value="">Select product variant</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.product_name} - {variant.color} / {variant.size} ({variant.variant_sku})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity to add</Label>
            <Input min={1} type="number" {...form.register("quantity")} />
          </div>
          <div className="space-y-2">
            <Label>Movement type</Label>
            <Select {...form.register("movementType")}>
              <option value={STOCK_MOVEMENT_TYPES.openingStock}>Opening stock</option>
              <option value={STOCK_MOVEMENT_TYPES.purchaseStock}>Purchase stock</option>
              <option value={STOCK_MOVEMENT_TYPES.returnAdded}>Return added</option>
              <option value={STOCK_MOVEMENT_TYPES.cancelledOrderRestore}>Cancelled order restore</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference type</Label>
            <Input {...form.register("referenceType")} placeholder="purchase_order" />
          </div>
          <div className="space-y-2">
            <Label>Reference ID</Label>
            <Input {...form.register("referenceId")} placeholder="Optional UUID" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Note</Label>
            <Textarea {...form.register("note")} />
          </div>
          {formError ? <p className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
          <div className="flex justify-end md:col-span-2">
            <Button disabled={isPending} type="submit">
              {isPending ? "Recording..." : "Record stock entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
