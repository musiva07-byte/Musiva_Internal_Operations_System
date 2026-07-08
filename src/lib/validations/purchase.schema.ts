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
const positiveMoney = z.coerce.number().positive("Must be greater than zero.");

export const purchaseItemSchema = z
  .object({
    productVariantId: z.string().uuid("Select a product variant."),
    quantityOrdered: z.coerce.number().int().positive("Ordered quantity must be greater than zero."),
    quantityReceived: z.coerce.number().int().min(0, "Received quantity cannot be negative."),
    // Supplier-currency price (e.g. INR)
    supplierUnitCost: positiveMoney,
    supplierCurrency: z.string().min(1).default("INR"),
    // These are pre-calculated on the client and saved to the DB as snapshots
    convertedUnitCostBhd: money,
    allocatedImportCostBhd: money.default(0),
    landedUnitCostBhd: money,
  })
  .refine((item) => item.quantityReceived <= item.quantityOrdered, {
    message: "Received quantity cannot exceed ordered quantity.",
    path: ["quantityReceived"],
  })
  .refine((item) => item.landedUnitCostBhd >= item.convertedUnitCostBhd, {
    message: "Landed cost cannot be less than converted cost.",
    path: ["landedUnitCostBhd"],
  });

export const purchaseSchema = z.object({
  supplierId: z.string().uuid("Select a supplier."),
  purchaseDate: z.string().min(1, "Purchase date is required."),
  expectedArrivalDate: optionalDate,
  status: z.enum([
    PURCHASE_STATUSES.draft,
    PURCHASE_STATUSES.ordered,
    PURCHASE_STATUSES.inTransit,
  ]),
  paymentStatus: z.enum([
    PURCHASE_PAYMENT_STATUSES.unpaid,
    PURCHASE_PAYMENT_STATUSES.partial,
    PURCHASE_PAYMENT_STATUSES.paid,
  ]),
  // Currency & exchange rate
  purchaseCurrency: z.string().min(1).default("INR"),
  exchangeRateToBhd: positiveMoney.describe("How many supplier-currency units equal 1 BHD"),
  exchangeRateDate: z.string().min(1, "Exchange rate date is required."),
  exchangeRateSource: z.string().default("manual"),
  // Import cost breakdown (all in BHD)
  discount: money.default(0),
  shippingCostBhd: money.default(0),
  customsCostBhd: money.default(0),
  bankFeeBhd: money.default(0),
  packagingCostBhd: money.default(0),
  otherImportCostBhd: money.default(0),
  notes: optionalText,
  items: z.array(purchaseItemSchema).min(1, "Select at least one item."),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
