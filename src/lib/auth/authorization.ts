import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/constants";

type StaffPermission = (role: StaffRole | null | undefined) => boolean;

function normalizeStaffRole(role: unknown): StaffRole | null {
  return typeof role === "string" ? (role as StaffRole) : null;
}

export async function requireStaffPermission(
  permission: StaffPermission,
  actionLabel: string,
) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { supabase: null, userId: null, role: null, error: "Supabase is not configured." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, userId: null, role: null, error: `You must be signed in to ${actionLabel}.` };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return {
      supabase,
      userId: user.id,
      role: null,
      error: "Your staff profile is not active. Please contact the owner.",
    };
  }

  const role = normalizeStaffRole(profile.role);
  if (!role || !permission(role)) {
    return { supabase, userId: user.id, role, error: "You do not have permission to perform this action." };
  }

  return { supabase, userId: user.id, role, error: null };
}
