import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "./config";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  if (!hasSupabaseEnv || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
