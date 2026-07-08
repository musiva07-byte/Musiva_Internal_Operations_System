"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  RefreshCcw,
  LayoutDashboard,
  MonitorDot,
  Package,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/constants";
import {
  canManageExpenses,
  canManagePurchases,
  canManageStaff,
  canManageSuppliers,
  canUpdateSettings,
  canViewReports,
} from "@/lib/auth/permissions";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildNavGroups(role: StaffRole | null | undefined): NavGroup[] {
  const dailyWork: NavItem[] = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "New Sale", href: "/admin/orders/new", icon: ShoppingBag },
    { name: "Orders", href: "/admin/orders", icon: ShoppingBag },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "Deliveries", href: "/admin/deliveries", icon: Truck },
  ];

  const catalogStock: NavItem[] = [
    { name: "Product Catalog", href: "/admin/products", icon: Package },
    { name: "Stock Management", href: "/admin/inventory", icon: Boxes },
    { name: "Receive Stock", href: "/admin/inventory/stock-entry", icon: PackagePlus },
    { name: "Returns & Exchanges", href: "/admin/returns", icon: RefreshCcw },
  ];

  const management: NavItem[] = [];

  if (canManagePurchases(role) || canManageSuppliers(role)) {
    management.push({ name: "Purchases", href: "/admin/purchases", icon: Package });
    management.push({ name: "Suppliers", href: "/admin/suppliers", icon: Store });
  }

  if (canManageExpenses(role)) {
    management.push({ name: "Expenses", href: "/admin/expenses", icon: ReceiptText });
  }

  if (canViewReports(role)) {
    management.push({ name: "Reports", href: "/admin/reports", icon: BarChart3 });
  }

  if (canManageStaff(role)) {
    management.push({ name: "Staff & Roles", href: "/admin/staff", icon: Users });
  }

  if (canUpdateSettings(role)) {
    management.push({ name: "Settings", href: "/admin/settings", icon: Settings });
    management.push({ name: "System", href: "/admin/settings/system", icon: MonitorDot });
  }

  const groups: NavGroup[] = [
    { label: "Daily work", items: dailyWork },
    { label: "Catalog & Stock", items: catalogStock },
  ];

  if (management.length > 0) {
    groups.push({ label: "Management", items: management });
  }

  return groups;
}

type AdminSidebarProps = {
  role?: StaffRole | null;
};

export function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = buildNavGroups(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto border-r border-musiva-border bg-musiva-sidebar px-5 py-6 shadow-soft lg:flex">
      <div className="border-b border-musiva-border pb-6">
        <Image
          alt="Moosiva Lux Wear"
          className="mb-4 h-20 w-20 rounded-full border border-musiva-champagne/60 object-cover shadow-sm"
          height={80}
          priority
          src="/moosiva-lux-wear-logo.jpeg"
          width={80}
        />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-musiva-gold">
          Moosiva
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-musiva-plum">Musiva Lux Wear</h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">Internal Operations System</p>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-5">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin/orders/new" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-musiva-sidebar-active text-musiva-sidebar-active-text"
                      : "text-musiva-plum/85 hover:bg-musiva-mauve-soft/45 hover:text-musiva-plum",
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-3">
        <LogoutButton variant="sidebar" />
        <div className="rounded-md border bg-musiva-ivory p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-musiva-gold">
            Bahrain
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Built for BHD, local governorates, boutique staff roles, and future ecommerce readiness.
          </p>
        </div>
      </div>
    </aside>
  );
}

// Legacy export for MobileAdminNav compatibility
export function getNavGroups(role: StaffRole | null | undefined): NavGroup[] {
  return buildNavGroups(role);
}
