export const STAFF_ROLES = {
  owner: "owner",
  manager: "manager",
  salesStaff: "sales_staff",
  inventoryStaff: "inventory_staff",
  deliveryCoordinator: "delivery_coordinator",
  accountant: "accountant",
} as const;

export const PRODUCT_MANAGEMENT_ROLES = {
  owner: STAFF_ROLES.owner,
  manager: STAFF_ROLES.manager,
  inventoryStaff: STAFF_ROLES.inventoryStaff,
} as const;

export const INVENTORY_MANAGEMENT_ROLES = PRODUCT_MANAGEMENT_ROLES;

export type StaffRole = (typeof STAFF_ROLES)[keyof typeof STAFF_ROLES];
