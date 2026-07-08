import { STAFF_ROLES, type StaffRole } from "@/lib/constants";

const roleRank: Record<StaffRole, number> = {
  [STAFF_ROLES.owner]: 100,
  [STAFF_ROLES.manager]: 70,
  [STAFF_ROLES.accountant]: 50,
  [STAFF_ROLES.inventoryStaff]: 40,
  [STAFF_ROLES.salesStaff]: 30,
  [STAFF_ROLES.deliveryCoordinator]: 20,
};

export function hasRoleAtLeast(userRole: StaffRole | null | undefined, requiredRole: StaffRole) {
  if (!userRole) {
    return false;
  }

  return roleRank[userRole] >= roleRank[requiredRole];
}

export function canAccessAdmin(userRole: StaffRole | null | undefined) {
  return Boolean(userRole && userRole in roleRank);
}

export function canManageProducts(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

export function canAdjustInventory(userRole: StaffRole | null | undefined) {
  return canManageProducts(userRole);
}

export function canManageCustomers(userRole: StaffRole | null | undefined) {
  return Boolean(userRole && userRole in roleRank);
}

export function canManageOrders(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.salesStaff
  );
}

export function canManageDeliveries(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.deliveryCoordinator ||
    userRole === STAFF_ROLES.salesStaff
  );
}

export function canProcessReturns(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.salesStaff ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

export function canManageSuppliers(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

export function canManagePurchases(userRole: StaffRole | null | undefined) {
  return canManageSuppliers(userRole);
}

export function canManageExpenses(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.accountant
  );
}

export function canViewReports(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.accountant ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

export function canManageStaff(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner;
}

export function canUpdateSettings(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Cost data: supplier prices, converted costs, landed costs, average cost, gross profit, margin.
 *  Accountant can view; sales_staff and delivery_coordinator cannot. */
export function canViewCostData(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.accountant
  );
}

/** Enter or edit initial buying cost (INR→BHD conversion) on new products.
 *  Narrower than canViewCostData — accountants view but cannot enter by default. */
export function canEnterBuyingCost(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

export function canManageExchangeRates(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Archive and restore products. Owner and manager only. */
export function canArchiveProducts(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Permanently delete products (only safe unused products). Owner and manager only. */
export function canDeleteProducts(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}
