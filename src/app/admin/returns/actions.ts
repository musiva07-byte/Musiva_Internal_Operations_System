"use server";

import { createReturn } from "@/lib/services/return.service";
import type { ReturnInput } from "@/lib/validations/return.schema";

export async function createReturnAction(input: ReturnInput) {
  const result = await createReturn(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
