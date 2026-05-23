"use server";

import { createExpense } from "@/lib/services/expense.service";
import type { ExpenseInput } from "@/lib/validations/expense.schema";

export async function createExpenseAction(input: ExpenseInput) {
  const result = await createExpense(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
