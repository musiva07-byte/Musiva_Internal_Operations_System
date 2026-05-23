import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageExpenses } from "@/lib/auth/permissions";
import { expenseSchema, type ExpenseInput } from "@/lib/validations/expense.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ExpenseCategory, ExpenseRow } from "@/types/database";
import type { PaginatedResult } from "@/types/app";

const PAGE_SIZE = 10;

type ExpenseFilters = {
  q?: string;
  category?: string;
  page?: number;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateExpenseUser() {
  return requireStaffPermission(canManageExpenses, "manage expenses");
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<PaginatedResult<ExpenseRow>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = filters.q?.trim();
  if (search) {
    query = query.or(`vendor.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category as ExpenseCategory);
  }

  const { data, count } = await query;

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getExpense(expenseId: string): Promise<ExpenseRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.from("expenses").select("*").eq("id", expenseId).maybeSingle();
  return data ?? null;
}

export async function createExpense(input: ExpenseInput): Promise<ServiceResult<ExpenseRow>> {
  const parsed = expenseSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateExpenseUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const expenseInput = parsed.data;
  const { data, error } = await auth.supabase
    .from("expenses")
    .insert({
      category: expenseInput.category,
      amount: expenseInput.amount,
      expense_date: expenseInput.expenseDate,
      payment_method: expenseInput.paymentMethod,
      vendor: expenseInput.vendor ?? null,
      notes: expenseInput.notes ?? null,
      attachment_url: expenseInput.attachmentUrl ?? null,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error || !data) {
    return serviceError("Expense could not be created. Please try again.");
  }

  await createAuditLog({
    action: "create_expense",
    tableName: "expenses",
    recordId: data.id,
    userId: auth.userId,
    metadata: {
      category: data.category,
      amount: data.amount,
      expense_date: data.expense_date,
    },
  });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/reports/finance");
  return serviceSuccess(data);
}
