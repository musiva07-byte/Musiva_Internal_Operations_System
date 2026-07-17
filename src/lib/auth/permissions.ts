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
 *  Inventory staff can enter buying prices but cannot view profit/margin. */
export function canEnterBuyingCost(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

export function canManageExchangeRates(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** View buying price (INR/BHD) without necessarily seeing profit/margin: anyone who can
 *  enter it (owner/manager/inventory_staff) plus accountant (view-only). Sales staff and
 *  delivery coordinators are excluded from both and see neither. */
export function canViewBuyingCost(userRole: StaffRole | null | undefined) {
  return canEnterBuyingCost(userRole) || canViewCostData(userRole);
}

/** Archive and restore products. Owner and manager only. */
export function canArchiveProducts(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Permanently delete products (only safe unused products). Owner and manager only. */
export function canDeleteProducts(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Publish/unpublish products to the public website (www.moosivabh.com). Owner and manager only.
 *  Inventory staff can still prepare website fields and save as draft/hidden via canManageProducts. */
export function canPublishProducts(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** View website order requests (customer checkout requests from www.moosivabh.com) and
 *  mark them contacted / open WhatsApp. Sales and inventory staff need this to follow up. */
export function canViewWebsiteRequests(userRole: StaffRole | null | undefined) {
  return (
    userRole === STAFF_ROLES.owner ||
    userRole === STAFF_ROLES.manager ||
    userRole === STAFF_ROLES.salesStaff ||
    userRole === STAFF_ROLES.inventoryStaff
  );
}

/** Mark a website request as contacted. Same roles as canViewWebsiteRequests. */
export function canContactWebsiteRequest(userRole: StaffRole | null | undefined) {
  return canViewWebsiteRequests(userRole);
}

/** Confirm or cancel a website request (and, in a later unit, convert it to a real order).
 *  Owner and manager only — this is a business decision, not a follow-up task. */
export function canDecideWebsiteRequest(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner || userRole === STAFF_ROLES.manager;
}

/** Reopen a cancelled website request back to "new". Owner only — cancellation is meant
 *  to be terminal; reopening is a rare override, not a routine action. */
export function canReopenWebsiteRequest(userRole: StaffRole | null | undefined) {
  return userRole === STAFF_ROLES.owner;
}
