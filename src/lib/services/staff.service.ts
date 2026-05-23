import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageStaff } from "@/lib/auth/permissions";
import { staffSchema, type StaffInput } from "@/lib/validations/staff.schema";
import { createAuditLog } from "./audit.service";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { ProfileRow, StaffRole } from "@/types/database";
import type { PaginatedResult } from "@/types/app";

const PAGE_SIZE = 10;

type StaffFilters = {
  q?: string;
  role?: string;
  page?: number;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

async function validateStaffManager() {
  return requireStaffPermission(canManageStaff, "manage staff");
}

export async function listStaff(filters: StaffFilters = {}): Promise<PaginatedResult<ProfileRow>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = filters.q?.trim();
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  if (filters.role && filters.role !== "all") {
    query = query.eq("role", filters.role as StaffRole);
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

export async function getStaffProfile(profileId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
  return data ?? null;
}

export async function createStaff(input: StaffInput): Promise<ServiceResult<ProfileRow>> {
  const parsed = staffSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await validateStaffManager();
  if (auth.error || !auth.supabase || !auth.userId) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return serviceError("SUPABASE_SERVICE_ROLE_KEY is required to create staff users.");
  }

  const staffInput = parsed.data;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: staffInput.email,
    password: staffInput.password,
    email_confirm: true,
    app_metadata: { role: staffInput.role },
    user_metadata: { full_name: staffInput.fullName },
  });

  if (authError || !authData.user) {
    return serviceError("Staff user could not be created. Check the email and try again.");
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .insert({
      id: authData.user.id,
      full_name: staffInput.fullName,
      email: staffInput.email,
      phone: staffInput.phone ?? null,
      role: staffInput.role as StaffRole,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return serviceError("Staff profile could not be saved.");
  }

  await createAuditLog({
    action: "manage_user",
    tableName: "profiles",
    recordId: profile.id,
    userId: auth.userId,
    metadata: {
      email: profile.email,
      role: profile.role,
      action: "create_staff",
    },
  });

  revalidatePath("/admin/staff");
  return serviceSuccess(profile);
}
