import { z } from "zod";
import { BAHRAIN_GOVERNORATES } from "@/lib/constants";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalGovernorate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.enum(BAHRAIN_GOVERNORATES).nullable().optional(),
);

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Customer name is required."),
  mobile: z.string().trim().min(6, "Customer mobile number is required."),
  whatsapp: optionalText,
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().email("Enter a valid email address.").nullable().optional(),
  ),
  governorate: optionalGovernorate,
  area: optionalText,
  block: optionalText,
  road: optionalText,
  building: optionalText,
  flat: optionalText,
  landmark: optionalText,
  deliveryNotes: optionalText,
});

export type CustomerInput = z.infer<typeof customerSchema>;
