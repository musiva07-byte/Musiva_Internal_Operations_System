import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "@/types/database";

type CurrentAuthState = {
  user: User | null;
  profile: ProfileRow | null;
};

export const getCurrentAuthState = cache(async (): Promise<CurrentAuthState> => {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { user: null, profile: null };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, profile: null };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .eq("status", "active")
      .maybeSingle();

    return { user, profile: profile ?? null };
  } catch {
    return { user: null, profile: null };
  }
});

export async function getCurrentUser() {
  const { user } = await getCurrentAuthState();
  return user;
}

export async function getCurrentStaffProfile(): Promise<ProfileRow | null> {
  const { profile } = await getCurrentAuthState();
  return profile;
}
