import { z } from "zod";
import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { customerSchema } from "./customer.schema";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);

export const orderItemSchema = z.object({
  productVariantId: z.string().uuid("Select a product variant."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  unitPrice: money,
  discount: money.default(0),
});

export const createOrderSchema = z.object({
  customerId: optionalUuid,
  customer: customerSchema,
  orderSource: z.enum([
    ORDER_SOURCES.instagram,
    ORDER_SOURCES.whatsapp,
    ORDER_SOURCES.website,
    ORDER_SOURCES.walkIn,
    ORDER_SOURCES.tiktok,
    ORDER_SOURCES.referral,
    ORDER_SOURCES.other,
  ]),
  orderStatus: z.enum([
    ORDER_STATUSES.new,
    ORDER_STATUSES.confirmed,
    ORDER_STATUSES.packed,
    ORDER_STATUSES.readyForPickup,
    ORDER_STATUSES.outForDelivery,
    ORDER_STATUSES.delivered,
    ORDER_STATUSES.cancelled,
    ORDER_STATUSES.returned,
    ORDER_STATUSES.exchangeRequested,
  ]),
  paymentStatus: z.enum([
    PAYMENT_STATUSES.unpaid,
    PAYMENT_STATUSES.paid,
    PAYMENT_STATUSES.partial,
    PAYMENT_STATUSES.cod,
    PAYMENT_STATUSES.refunded,
  ]),
  paymentMethod: z
    .enum([
      PAYMENT_METHODS.cash,
      PAYMENT_METHODS.benefitPay,
      PAYMENT_METHODS.card,
      PAYMENT_METHODS.bankTransfer,
      PAYMENT_METHODS.paymentLink,
      PAYMENT_METHODS.cashOnDelivery,
    ])
    .nullable()
    .optional(),
  deliveryRequired: z.coerce.boolean().default(false),
  deliveryDate: optionalText,
  deliveryTimeSlot: optionalText,
  deliveryCharge: money.default(0),
  amountPaid: money.default(0),
  notes: optionalText,
  paymentReference: optionalText,
  paymentNote: optionalText,
  items: z.array(orderItemSchema).min(1, "Please select at least one product."),
});

export const updateOrderSchema = z.object({
  orderStatus: createOrderSchema.shape.orderStatus,
  paymentStatus: createOrderSchema.shape.paymentStatus,
  paymentMethod: createOrderSchema.shape.paymentMethod,
  amountPaid: money,
  notes: optionalText,
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
