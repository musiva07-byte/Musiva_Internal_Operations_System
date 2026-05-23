import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().url("Enter a valid logo URL.").nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required."),
  logoUrl: optionalUrl,
  logoPath: optionalText,
  whatsappNumber: optionalText,
  instagramHandle: optionalText,
  businessAddress: optionalText,
  invoiceFooter: z.string().trim().min(2, "Invoice footer is required."),
  returnPolicyText: z.string().trim().min(2, "Return policy is required."),
  defaultDeliveryCharge: money,
  currency: z.string().trim().min(1, "Currency is required.").default("BHD"),
  lowStockDefaultQuantity: z.coerce.number().int().min(0),
  receiptTheme: z.string().trim().min(1, "Receipt theme is required."),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
