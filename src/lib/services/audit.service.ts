import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function createAuditLog(input: {
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  userId?: string | null;
  metadata?: Json;
}) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return;
  }

  await supabase.from("audit_logs").insert({
    action: input.action,
    table_name: input.tableName ?? null,
    record_id: input.recordId ?? null,
    user_id: input.userId ?? null,
    metadata: input.metadata ?? {},
  });
}
