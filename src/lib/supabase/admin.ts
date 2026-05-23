import { createClient } from "@supabase/supabase-js";
import { hasSupabaseServiceRoleEnv, supabaseServiceRoleKey, supabaseUrl } from "./config";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  if (!hasSupabaseServiceRoleEnv || !supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
