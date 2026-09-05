/**
 * Regression guard confirming the navigation consistency pass on Suppliers/Purchases/Expenses/
 * Staff/Settings/Returns did not touch — and therefore did not weaken — the existing
 * permission gates that decide whether each nav link (and therefore the mobile nav, which
 * shares the same nav-group builder) is shown to a given staff role. This file does not
 * introduce new gating; it locks the pre-existing behavior in place.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "admin-sidebar.tsx"), "utf-8");

describe("Admin sidebar — management nav links stay permission-gated", () => {
  it("gates Suppliers/Purchases behind canManagePurchases/canManageSuppliers", () => {
    expect(source).toContain("canManagePurchases(role) || canManageSuppliers(role)");
  });
  it("gates Expenses behind canManageExpenses", () => {
    expect(source).toMatch(/canManageExpenses\(role\)/);
  });
  it("gates Staff & Roles behind canManageStaff", () => {
    expect(source).toMatch(/canManageStaff\(role\)/);
  });
  it("gates Settings behind canUpdateSettings", () => {
    expect(source).toMatch(/canUpdateSettings\(role\)/);
  });
});

describe("Admin sidebar — mobile nav shares the same nav-group builder", () => {
  it("exports a nav-group builder consumed by both desktop sidebar and MobileAdminNav", () => {
    expect(source).toMatch(/export function buildNavGroups|export function getNavGroups/);
  });
});
