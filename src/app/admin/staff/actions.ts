"use server";

import { createStaff } from "@/lib/services/staff.service";
import type { StaffInput } from "@/lib/validations/staff.schema";

export async function createStaffAction(input: StaffInput) {
  const result = await createStaff(input);

  if (result.error || !result.data) {
    return { ok: false, error: result.error, id: null };
  }

  return { ok: true, error: null, id: result.data.id };
}
