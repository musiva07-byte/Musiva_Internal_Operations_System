import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

export const supplierSchema = z.object({
  supplierName: z.string().trim().min(2, "Supplier name is required."),
  contactPerson: optionalText,
  phone: optionalText,
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().email("Enter a valid email address.").nullable().optional(),
  ),
  country: optionalText,
  address: optionalText,
  notes: optionalText,
});

export type SupplierInput = z.infer<typeof supplierSchema>;
