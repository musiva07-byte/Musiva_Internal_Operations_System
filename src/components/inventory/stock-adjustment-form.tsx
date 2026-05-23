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
import { stockAdjustmentSchema, type StockAdjustmentInput } from "@/lib/validations/inventory.schema";
import { adjustStockAction } from "@/app/admin/inventory/actions";
import type { InventoryVariantItem } from "@/types/app";

type StockAdjustmentFormProps = {
  variants: InventoryVariantItem[];
};

export function StockAdjustmentForm({ variants }: StockAdjustmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema) as Resolver<StockAdjustmentInput>,
    defaultValues: {
      productVariantId: "",
      newQuantity: 0,
      note: "",
      referenceType: "manual_adjustment",
      referenceId: null,
    },
  });

  function onSubmit(values: StockAdjustmentInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await adjustStockAction(values);
      if (!result.ok) {
        setFormError(result.error ?? "Stock adjustment could not be recorded.");
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
                  {variant.product_name} - {variant.color} / {variant.size} ({variant.variant_sku}) current:{" "}
                  {variant.stock_quantity}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>New stock quantity</Label>
            <Input min={0} type="number" {...form.register("newQuantity")} />
          </div>
          <div className="space-y-2">
            <Label>Reference ID</Label>
            <Input {...form.register("referenceId")} placeholder="Optional UUID" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Adjustment note</Label>
            <Textarea {...form.register("note")} placeholder="Reason for this manual adjustment" />
          </div>
          {formError ? <p className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
          <div className="flex justify-end md:col-span-2">
            <Button disabled={isPending} type="submit">
              {isPending ? "Recording..." : "Record adjustment"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
