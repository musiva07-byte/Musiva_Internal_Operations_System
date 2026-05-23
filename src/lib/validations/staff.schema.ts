import { z } from "zod";
import { STAFF_ROLES } from "@/lib/constants";

const allowedRoles = [
  STAFF_ROLES.owner,
  STAFF_ROLES.manager,
  STAFF_ROLES.salesStaff,
  STAFF_ROLES.inventoryStaff,
  STAFF_ROLES.accountant,
  STAFF_ROLES.deliveryCoordinator,
] as const;

export const staffSchema = z.object({
  fullName: z.string().trim().min(2, "Staff name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().nullable().optional(),
  ),
  role: z.enum(allowedRoles),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
});

export type StaffInput = z.infer<typeof staffSchema>;
