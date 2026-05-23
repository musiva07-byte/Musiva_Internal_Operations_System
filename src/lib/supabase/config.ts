export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const hasSupabaseServiceRoleEnv = Boolean(supabaseUrl && supabaseServiceRoleKey);
