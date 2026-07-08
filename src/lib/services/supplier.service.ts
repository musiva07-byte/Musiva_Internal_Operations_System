import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageSuppliers } from "@/lib/auth/permissions";
import { supplierSchema, type SupplierInput } from "@/lib/validations/supplier.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { PurchaseOrderRow, SupplierRow } from "@/types/database";
import type { PaginatedResult, SupplierListItem, SupplierWithPurchases } from "@/types/app";

const PAGE_SIZE = 10;

type SupplierFilters = {
  q?: string;
  page?: number;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateSupplierUser() {
  return requireStaffPermission(canManageSuppliers, "manage suppliers");
}

export async function listSuppliers(filters: SupplierFilters = {}): Promise<PaginatedResult<SupplierListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("suppliers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = filters.q?.trim();
  if (search) {
    query = query.or(`supplier_name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, count } = await query;
  const rows = data ?? [];
  const supplierIds = rows.map((supplier) => supplier.id);

  // Narrow to 3 columns only and cap at 100 rows (10 suppliers × up to 10 purchases).
  const { data: purchases } = supplierIds.length
    ? await supabase
        .from("purchase_orders")
        .select("supplier_id, grand_total, purchase_date")
        .in("supplier_id", supplierIds)
        .order("purchase_date", { ascending: false })
        .limit(100)
    : { data: [] as Pick<PurchaseOrderRow, "supplier_id" | "grand_total" | "purchase_date">[] };

  return {
    data: rows.map((supplier) => {
      const supplierPurchases = (purchases ?? []).filter((purchase) => purchase.supplier_id === supplier.id);
      return {
        ...supplier,
        purchase_count: supplierPurchases.length,
        total_purchase_value: supplierPurchases.reduce((sum, purchase) => sum + Number(purchase.grand_total), 0),
        last_purchase_date: supplierPurchases[0]?.purchase_date ?? null,
      };
    }),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function listAllSuppliers(): Promise<SupplierRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .order("supplier_name", { ascending: true })
    .limit(200);

  return data ?? [];
}

export async function getSupplier(supplierId: string): Promise<SupplierWithPurchases | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: supplier } = await supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle();

  if (!supplier) {
    return null;
  }

  const { data: purchases } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("purchase_date", { ascending: false });

  return {
    ...supplier,
    purchases: purchases ?? [],
  };
}

export async function createSupplier(input: SupplierInput): Promise<ServiceResult<SupplierRow>> {
  const parsed = supplierSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateSupplierUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supplierInput = parsed.data;
  const { data, error } = await auth.supabase
    .from("suppliers")
    .insert({
      supplier_name: supplierInput.supplierName,
      contact_person: supplierInput.contactPerson ?? null,
      phone: supplierInput.phone ?? null,
      email: supplierInput.email ?? null,
      country: supplierInput.country ?? null,
      address: supplierInput.address ?? null,
      notes: supplierInput.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return serviceError("Supplier could not be created. Please try again.");
  }

  await createAuditLog({
    action: "create_supplier",
    tableName: "suppliers",
    recordId: data.id,
    userId: auth.userId,
    metadata: { supplier_name: data.supplier_name },
  });

  revalidatePath("/admin/suppliers");
  return serviceSuccess(data);
}

export async function updateSupplier(supplierId: string, input: SupplierInput): Promise<ServiceResult<SupplierRow>> {
  const parsed = supplierSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateSupplierUser();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const supplierInput = parsed.data;
  const { data, error } = await auth.supabase
    .from("suppliers")
    .update({
      supplier_name: supplierInput.supplierName,
      contact_person: supplierInput.contactPerson ?? null,
      phone: supplierInput.phone ?? null,
      email: supplierInput.email ?? null,
      country: supplierInput.country ?? null,
      address: supplierInput.address ?? null,
      notes: supplierInput.notes ?? null,
    })
    .eq("id", supplierId)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Supplier could not be updated.");
  }

  await createAuditLog({
    action: "update_supplier",
    tableName: "suppliers",
    recordId: data.id,
    userId: auth.userId,
    metadata: { supplier_name: data.supplier_name },
  });

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${supplierId}`);
  return serviceSuccess(data);
}
