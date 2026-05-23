import { z } from "zod";
import { BAHRAIN_GOVERNORATES, DELIVERY_STATUSES } from "@/lib/constants";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalGovernorate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.enum(BAHRAIN_GOVERNORATES).nullable().optional(),
);

export const deliveryUpdateSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required."),
  phone: z.string().trim().min(6, "Phone number is required."),
  governorate: optionalGovernorate,
  area: optionalText,
  block: optionalText,
  road: optionalText,
  building: optionalText,
  flat: optionalText,
  landmark: optionalText,
  deliveryNote: optionalText,
  deliveryDate: optionalText,
  deliveryTimeSlot: optionalText,
  courierName: optionalText,
  courierPhone: optionalText,
  deliveryStatus: z.enum([
    DELIVERY_STATUSES.pending,
    DELIVERY_STATUSES.packed,
    DELIVERY_STATUSES.readyForPickup,
    DELIVERY_STATUSES.withCourier,
    DELIVERY_STATUSES.outForDelivery,
    DELIVERY_STATUSES.delivered,
    DELIVERY_STATUSES.failed,
    DELIVERY_STATUSES.returned,
  ]),
});

export const deliveryStatusUpdateSchema = z.object({
  deliveryStatus: deliveryUpdateSchema.shape.deliveryStatus,
});

export type DeliveryUpdateInput = z.infer<typeof deliveryUpdateSchema>;
export type DeliveryStatusUpdateInput = z.infer<typeof deliveryStatusUpdateSchema>;
