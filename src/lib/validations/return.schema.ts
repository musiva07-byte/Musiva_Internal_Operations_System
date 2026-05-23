import { z } from "zod";
import {
  RETURN_CONDITIONS,
  RETURN_ITEM_ACTIONS,
  RETURN_REASONS,
  RETURN_STATUSES,
  RETURN_TYPES,
} from "@/lib/constants";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);

export const returnItemSchema = z.object({
  productVariantId: z.string().uuid("Select an order item."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  action: z.enum([
    RETURN_ITEM_ACTIONS.addBackToStock,
    RETURN_ITEM_ACTIONS.markDamaged,
    RETURN_ITEM_ACTIONS.exchange,
    RETURN_ITEM_ACTIONS.refundOnly,
    RETURN_ITEM_ACTIONS.noStockChange,
  ]),
});

export const returnSchema = z.object({
  originalOrderId: z.string().uuid("Select the original order."),
  returnType: z.enum([RETURN_TYPES.return, RETURN_TYPES.exchange]),
  reason: z.enum([
    RETURN_REASONS.sizeIssue,
    RETURN_REASONS.colorIssue,
    RETURN_REASONS.damagedItem,
    RETURN_REASONS.wrongItemSent,
    RETURN_REASONS.customerChangedMind,
    RETURN_REASONS.deliveryFailed,
    RETURN_REASONS.other,
  ]),
  condition: z.enum([
    RETURN_CONDITIONS.sellable,
    RETURN_CONDITIONS.damaged,
    RETURN_CONDITIONS.needsReview,
  ]),
  refundAmount: money.default(0),
  exchangeOrderId: optionalUuid,
  status: z.enum([
    RETURN_STATUSES.pending,
    RETURN_STATUSES.approved,
    RETURN_STATUSES.completed,
    RETURN_STATUSES.cancelled,
  ]),
  notes: optionalText,
  items: z.array(returnItemSchema).min(1, "Select at least one item."),
});

export type ReturnInput = z.infer<typeof returnSchema>;
export type ReturnItemInput = z.infer<typeof returnItemSchema>;
