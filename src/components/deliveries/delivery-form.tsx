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
import { BAHRAIN_GOVERNORATES, DELIVERY_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import { deliveryUpdateSchema, type DeliveryUpdateInput } from "@/lib/validations/delivery.schema";
import { updateDeliveryAction } from "@/app/admin/deliveries/actions";
import type { DeliveryRow } from "@/types/database";

type DeliveryFormProps = {
  delivery: DeliveryRow;
};

function mapDelivery(delivery: DeliveryRow): DeliveryUpdateInput {
  return {
    customerName: delivery.customer_name,
    phone: delivery.phone,
    governorate: delivery.governorate as DeliveryUpdateInput["governorate"],
    area: delivery.area,
    block: delivery.block,
    road: delivery.road,
    building: delivery.building,
    flat: delivery.flat,
    landmark: delivery.landmark,
    deliveryNote: delivery.delivery_note,
    deliveryDate: delivery.delivery_date,
    deliveryTimeSlot: delivery.delivery_time_slot,
    courierName: delivery.courier_name,
    courierPhone: delivery.courier_phone,
    deliveryStatus: delivery.delivery_status,
  };
}

export function DeliveryForm({ delivery }: DeliveryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<DeliveryUpdateInput>({
    resolver: zodResolver(deliveryUpdateSchema) as Resolver<DeliveryUpdateInput>,
    defaultValues: mapDelivery(delivery),
  });

  function onSubmit(values: DeliveryUpdateInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await updateDeliveryAction(delivery.id, values);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Delivery could not be updated.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Delivery status">
            <Select {...form.register("deliveryStatus")}>
              {Object.values(DELIVERY_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Delivery date">
            <Input type="date" {...form.register("deliveryDate")} />
          </Field>
          <Field label="Customer name">
            <Input {...form.register("customerName")} />
          </Field>
          <Field label="Phone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Courier name">
            <Input {...form.register("courierName")} />
          </Field>
          <Field label="Courier phone">
            <Input {...form.register("courierPhone")} />
          </Field>
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
          <Field label="Delivery time slot">
            <Input {...form.register("deliveryTimeSlot")} placeholder="4:00 PM - 7:00 PM" />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Delivery notes</Label>
            <Textarea {...form.register("deliveryNote")} />
          </div>
          {formError ? <p className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
          <div className="flex justify-end gap-3 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save delivery"}
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
