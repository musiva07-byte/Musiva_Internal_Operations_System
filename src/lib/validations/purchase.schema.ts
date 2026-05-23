import { z } from "zod";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "@/lib/constants";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);

export const purchaseItemSchema = z
  .object({
    productVariantId: z.string().uuid("Select a product variant."),
    quantityOrdered: z.coerce.number().int().positive("Ordered quantity must be greater than zero."),
    quantityReceived: z.coerce.number().int().min(0, "Received quantity cannot be negative."),
    costPrice: money,
  })
  .refine((item) => item.quantityReceived <= item.quantityOrdered, {
    message: "Received quantity cannot exceed ordered quantity.",
    path: ["quantityReceived"],
  });

export const purchaseSchema = z.object({
  supplierId: z.string().uuid("Select a supplier."),
  purchaseDate: z.string().min(1, "Purchase date is required."),
  expectedArrivalDate: optionalDate,
  status: z.enum([PURCHASE_STATUSES.draft, PURCHASE_STATUSES.ordered]),
  paymentStatus: z.enum([
    PURCHASE_PAYMENT_STATUSES.unpaid,
    PURCHASE_PAYMENT_STATUSES.partial,
    PURCHASE_PAYMENT_STATUSES.paid,
  ]),
  discount: money.default(0),
  shippingCost: money.default(0),
  notes: optionalText,
  items: z.array(purchaseItemSchema).min(1, "Select at least one item."),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
