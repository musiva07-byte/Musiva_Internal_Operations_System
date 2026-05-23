import { z } from "zod";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().url("Enter a valid attachment URL.").nullable().optional(),
);

const money = z.coerce.number().min(0).multipleOf(0.001);

export const expenseSchema = z.object({
  category: z.enum([
    EXPENSE_CATEGORIES.productPurchase,
    EXPENSE_CATEGORIES.packaging,
    EXPENSE_CATEGORIES.delivery,
    EXPENSE_CATEGORIES.marketing,
    EXPENSE_CATEGORIES.rent,
    EXPENSE_CATEGORIES.staffSalary,
    EXPENSE_CATEGORIES.utilities,
    EXPENSE_CATEGORIES.software,
    EXPENSE_CATEGORIES.miscellaneous,
  ]),
  amount: money.refine((value) => value > 0, "Amount must be greater than zero."),
  expenseDate: z.string().min(1, "Expense date is required."),
  paymentMethod: z.enum([
    PAYMENT_METHODS.cash,
    PAYMENT_METHODS.benefitPay,
    PAYMENT_METHODS.card,
    PAYMENT_METHODS.bankTransfer,
    PAYMENT_METHODS.paymentLink,
    PAYMENT_METHODS.cashOnDelivery,
  ]),
  vendor: optionalText,
  notes: optionalText,
  attachmentUrl: optionalUrl,
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
